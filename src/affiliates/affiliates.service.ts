import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAffiliateDto } from './dto/create-affiliate.dto';
import { UpdateAffiliateDto } from './dto/update-affiliate.dto';

@Injectable()
export class AffiliatesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAffiliateDto) {
    const code = dto.code.toUpperCase();

    const existing = await this.prisma.affiliate.findUnique({
      where: { code },
    });
    if (existing) {
      throw new ConflictException(`Código "${code}" já está em uso`);
    }

    return this.prisma.affiliate.create({
      data: {
        name: dto.name,
        code,
        commissionPercent: dto.commissionPercent ?? 30,
        userId: dto.userId ?? null,
      },
    });
  }

  async findAll() {
    const affiliates = await this.prisma.affiliate.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { earnings: true } },
        user: { select: { id: true, email: true, name: true } },
      },
    });

    // Calcular totais para cada afiliado
    const result = await Promise.all(
      affiliates.map(async (affiliate) => {
        const totals = await this.prisma.affiliateEarning.aggregate({
          where: { affiliateId: affiliate.id },
          _sum: { commissionCents: true },
        });

        const pendingTotals = await this.prisma.affiliateEarning.aggregate({
          where: { affiliateId: affiliate.id, status: 'PENDING' },
          _sum: { commissionCents: true },
        });

        return {
          ...affiliate,
          totalEarningsCents: totals._sum.commissionCents ?? 0,
          pendingEarningsCents: pendingTotals._sum.commissionCents ?? 0,
          referralsCount: affiliate._count.earnings,
        };
      }),
    );

    return result;
  }

  async findById(id: string) {
    const affiliate = await this.prisma.affiliate.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });

    if (!affiliate) {
      throw new NotFoundException('Afiliado não encontrado');
    }

    return affiliate;
  }

  async getEarnings(affiliateId: string) {
    const affiliate = await this.prisma.affiliate.findUnique({
      where: { id: affiliateId },
    });
    if (!affiliate) {
      throw new NotFoundException('Afiliado não encontrado');
    }

    const earnings = await this.prisma.affiliateEarning.findMany({
      where: { affiliateId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, name: true } },
        payment: { select: { id: true, type: true, amountCents: true, createdAt: true } },
      },
    });

    const totals = await this.prisma.affiliateEarning.aggregate({
      where: { affiliateId },
      _sum: { commissionCents: true, amountCents: true },
    });

    const pendingTotals = await this.prisma.affiliateEarning.aggregate({
      where: { affiliateId, status: 'PENDING' },
      _sum: { commissionCents: true },
    });

    const paidTotals = await this.prisma.affiliateEarning.aggregate({
      where: { affiliateId, status: 'PAID' },
      _sum: { commissionCents: true },
    });

    return {
      affiliate,
      earnings,
      summary: {
        totalRevenueCents: totals._sum.amountCents ?? 0,
        totalCommissionCents: totals._sum.commissionCents ?? 0,
        pendingCommissionCents: pendingTotals._sum.commissionCents ?? 0,
        paidCommissionCents: paidTotals._sum.commissionCents ?? 0,
      },
    };
  }

  async markEarningsPaid(earningIds: string[]) {
    const result = await this.prisma.affiliateEarning.updateMany({
      where: {
        id: { in: earningIds },
        status: 'PENDING',
      },
      data: {
        status: 'PAID',
        paidAt: new Date(),
      },
    });

    return { updated: result.count };
  }

  async update(id: string, dto: UpdateAffiliateDto) {
    const affiliate = await this.prisma.affiliate.findUnique({
      where: { id },
    });
    if (!affiliate) {
      throw new NotFoundException('Afiliado não encontrado');
    }

    return this.prisma.affiliate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.commissionPercent !== undefined && { commissionPercent: dto.commissionPercent }),
        ...(dto.userId !== undefined && { userId: dto.userId || null }),
      },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });
  }

  async toggleActive(id: string) {
    const affiliate = await this.prisma.affiliate.findUnique({
      where: { id },
    });
    if (!affiliate) {
      throw new NotFoundException('Afiliado não encontrado');
    }

    return this.prisma.affiliate.update({
      where: { id },
      data: { isActive: !affiliate.isActive },
    });
  }

  async getMyAffiliate(userId: string) {
    const affiliate = await this.prisma.affiliate.findFirst({
      where: { userId },
    });

    if (!affiliate) {
      return null;
    }

    const totals = await this.prisma.affiliateEarning.aggregate({
      where: { affiliateId: affiliate.id },
      _sum: { commissionCents: true, amountCents: true },
      _count: true,
    });

    const pendingTotals = await this.prisma.affiliateEarning.aggregate({
      where: { affiliateId: affiliate.id, status: 'PENDING' },
      _sum: { commissionCents: true },
    });

    const paidTotals = await this.prisma.affiliateEarning.aggregate({
      where: { affiliateId: affiliate.id, status: 'PAID' },
      _sum: { commissionCents: true },
    });

    const referredUsers = await this.prisma.user.count({
      where: { referredByCode: affiliate.code },
    });

    const earnings = await this.prisma.affiliateEarning.findMany({
      where: { affiliateId: affiliate.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        amountCents: true,
        commissionCents: true,
        status: true,
        paidAt: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
        payment: {
          select: {
            type: true,
            amountCents: true,
            subscription: {
              select: { plan: { select: { name: true, slug: true } } },
            },
            creditPackage: {
              select: { name: true, credits: true },
            },
          },
        },
      },
    });

    return {
      affiliate: {
        id: affiliate.id,
        code: affiliate.code,
        name: affiliate.name,
        commissionPercent: affiliate.commissionPercent,
        isActive: affiliate.isActive,
        createdAt: affiliate.createdAt,
      },
      summary: {
        referredUsers,
        totalPayments: totals._count,
        totalRevenueCents: totals._sum.amountCents ?? 0,
        totalCommissionCents: totals._sum.commissionCents ?? 0,
        pendingCommissionCents: pendingTotals._sum.commissionCents ?? 0,
        paidCommissionCents: paidTotals._sum.commissionCents ?? 0,
      },
      earnings,
    };
  }

  async getDashboard() {
    const totalAffiliates = await this.prisma.affiliate.count();
    const activeAffiliates = await this.prisma.affiliate.count({
      where: { isActive: true },
    });

    const totalEarnings = await this.prisma.affiliateEarning.aggregate({
      _sum: { commissionCents: true, amountCents: true },
      _count: true,
    });

    const pendingEarnings = await this.prisma.affiliateEarning.aggregate({
      where: { status: 'PENDING' },
      _sum: { commissionCents: true },
    });

    const paidEarnings = await this.prisma.affiliateEarning.aggregate({
      where: { status: 'PAID' },
      _sum: { commissionCents: true },
    });

    const referredUsers = await this.prisma.user.count({
      where: { referredByCode: { not: null } },
    });

    return {
      totalAffiliates,
      activeAffiliates,
      referredUsers,
      totalPayments: totalEarnings._count,
      totalRevenueCents: totalEarnings._sum.amountCents ?? 0,
      totalCommissionCents: totalEarnings._sum.commissionCents ?? 0,
      pendingCommissionCents: pendingEarnings._sum.commissionCents ?? 0,
      paidCommissionCents: paidEarnings._sum.commissionCents ?? 0,
    };
  }
}
