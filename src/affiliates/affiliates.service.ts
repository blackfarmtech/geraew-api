import { Injectable, ConflictException, Logger, NotFoundException } from '@nestjs/common';
import { PixKeyType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from '../payments/stripe.service';
import { EmailService } from '../email/email.service';
import { CreateAffiliateDto } from './dto/create-affiliate.dto';
import { UpdateAffiliateDto } from './dto/update-affiliate.dto';
import { UpdatePixKeyDto } from './dto/update-pix-key.dto';
import { MarkEarningsPaidDto } from './dto/mark-paid.dto';
import { AffiliateDiscountScope } from '@prisma/client';

/** Saldos de um afiliado em uma única moeda. Blocos nunca são somados entre si. */
export interface CurrencySummary {
  currency: string;
  totalPayments: number;
  totalRevenueCents: number;
  totalCommissionCents: number;
  pendingCommissionCents: number;
  availableCommissionCents: number;
  maturingCommissionCents: number;
  paidCommissionCents: number;
}

function emptySummary(currency: string): CurrencySummary {
  return {
    currency,
    totalPayments: 0,
    totalRevenueCents: 0,
    totalCommissionCents: 0,
    pendingCommissionCents: 0,
    availableCommissionCents: 0,
    maturingCommissionCents: 0,
    paidCommissionCents: 0,
  };
}

@Injectable()
export class AffiliatesService {
  private readonly logger = new Logger(AffiliatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly emailService: EmailService,
  ) {}

  async create(dto: CreateAffiliateDto) {
    const code = dto.code.toUpperCase();

    const existing = await this.prisma.affiliate.findUnique({
      where: { code },
    });
    if (existing) {
      throw new ConflictException(`Código "${code}" já está em uso`);
    }

    const affiliate = await this.prisma.affiliate.create({
      data: {
        name: dto.name,
        code,
        commissionPercent: dto.commissionPercent ?? 30,
        userId: dto.userId ?? null,
        discountPercent: dto.discountPercent ?? null,
        discountAppliesTo: dto.discountAppliesTo ?? AffiliateDiscountScope.FIRST_PURCHASE,
      },
    });

    if (dto.discountPercent && dto.discountPercent > 0) {
      try {
        const { couponId, promotionCodeId } = await this.stripeService.createAffiliateCoupon(
          affiliate.id,
          code,
          dto.discountPercent,
        );
        return this.prisma.affiliate.update({
          where: { id: affiliate.id },
          data: { stripeCouponId: couponId, stripePromotionCodeId: promotionCodeId },
        });
      } catch (err) {
        // Rollback: remove afiliado se nao conseguiu criar cupom
        await this.prisma.affiliate.delete({ where: { id: affiliate.id } });
        throw err;
      }
    }

    return affiliate;
  }

  async findAll() {
    const affiliates = await this.prisma.affiliate.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { earnings: true } },
        user: { select: { id: true, email: true, name: true } },
      },
    });

    if (affiliates.length === 0) return [];

    // Single aggregated query to avoid N+1 (estourava o pool do Supabase em session mode)
    const grouped = await this.prisma.affiliateEarning.groupBy({
      by: ['affiliateId', 'status', 'currency'],
      where: { affiliateId: { in: affiliates.map((a) => a.id) } },
      _sum: { commissionCents: true },
    });

    // totais por afiliado E por moeda — a lista do admin mostra um valor por moeda
    const totalsByAffiliate = new Map<string, Map<string, { total: number; pending: number }>>();
    for (const row of grouped) {
      const byCurrency = totalsByAffiliate.get(row.affiliateId) ?? new Map();
      const current = byCurrency.get(row.currency) ?? { total: 0, pending: 0 };
      const amount = row._sum.commissionCents ?? 0;
      current.total += amount;
      if (row.status === 'PENDING') current.pending += amount;
      byCurrency.set(row.currency, current);
      totalsByAffiliate.set(row.affiliateId, byCurrency);
    }

    // Single query to count referred users per affiliate code
    const referralRows = await this.prisma.user.groupBy({
      by: ['referredByCode'],
      where: { referredByCode: { in: affiliates.map((a) => a.code) } },
      _count: { _all: true },
    });

    const referredUsersByCode = new Map<string, number>();
    for (const row of referralRows) {
      if (row.referredByCode) {
        referredUsersByCode.set(row.referredByCode, row._count._all);
      }
    }

    return affiliates.map((affiliate) => {
      const byCurrency = totalsByAffiliate.get(affiliate.id) ?? new Map();
      return {
        ...affiliate,
        earningsByCurrency: [...byCurrency.entries()]
          .map(([currency, totals]) => ({
            currency,
            totalEarningsCents: totals.total,
            pendingEarningsCents: totals.pending,
          }))
          .sort((a, b) => (a.currency === 'BRL' ? -1 : b.currency === 'BRL' ? 1 : a.currency.localeCompare(b.currency))),
        referralsCount: affiliate._count.earnings,
        referredUsersCount: referredUsersByCode.get(affiliate.code) ?? 0,
      };
    });
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
        payment: {
          select: { id: true, type: true, amountCents: true, currency: true, createdAt: true },
        },
      },
    });

    const maturationDate = new Date();
    maturationDate.setDate(maturationDate.getDate() - 30);

    return {
      affiliate,
      earnings,
      summary: {
        byCurrency: await this.aggregateByCurrency({ affiliateId }, maturationDate),
      },
    };
  }

  async markEarningsPaid(dto: MarkEarningsPaidDto) {
    const { earningIds, receiptBase64, receiptFilename, receiptMimeType } = dto;

    // Capture earnings + affiliate info before updating (so we can group by affiliate for email)
    const earnings = await this.prisma.affiliateEarning.findMany({
      where: { id: { in: earningIds }, status: 'PENDING' },
      select: {
        id: true,
        commissionCents: true,
        currency: true,
        createdAt: true,
        affiliate: {
          select: {
            id: true,
            name: true,
            pixKey: true,
            pixKeyType: true,
            user: { select: { email: true, name: true } },
          },
        },
      },
    });

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

    // Um email por afiliado, com os totais discriminados por moeda — um lote pode
    // misturar BRL e USD, e somar os dois num valor só seria mentira
    const byAffiliate = new Map<
      string,
      { email: string; name: string; totalsByCurrency: Map<string, number>; count: number }
    >();

    for (const earning of earnings) {
      const email = earning.affiliate.user?.email;
      if (!email) {
        this.logger.warn(
          `Skipping payment email for affiliate ${earning.affiliate.id} — no linked user email`,
        );
        continue;
      }
      const current = byAffiliate.get(earning.affiliate.id) ?? {
        email,
        name: earning.affiliate.user?.name || earning.affiliate.name,
        totalsByCurrency: new Map<string, number>(),
        count: 0,
      };
      current.totalsByCurrency.set(
        earning.currency,
        (current.totalsByCurrency.get(earning.currency) ?? 0) + earning.commissionCents,
      );
      current.count += 1;
      byAffiliate.set(earning.affiliate.id, current);
    }

    const attachment =
      receiptBase64 && receiptFilename
        ? {
            filename: receiptFilename,
            content: receiptBase64,
            contentType: receiptMimeType,
          }
        : undefined;

    await Promise.all(
      Array.from(byAffiliate.values()).map((info) =>
        this.emailService.sendAffiliatePaymentEmail({
          to: info.email,
          name: info.name,
          totals: [...info.totalsByCurrency.entries()].map(([currency, cents]) => ({
            currency,
            cents,
          })),
          earningsCount: info.count,
          attachment,
        }),
      ),
    );

    return { updated: result.count };
  }

  async update(id: string, dto: UpdateAffiliateDto) {
    const affiliate = await this.prisma.affiliate.findUnique({
      where: { id },
    });
    if (!affiliate) {
      throw new NotFoundException('Afiliado não encontrado');
    }

    const oldDiscount = affiliate.discountPercent ?? null;
    const discountProvided = dto.discountPercent !== undefined;
    const newDiscount = discountProvided ? dto.discountPercent : oldDiscount;
    const discountChanged = discountProvided && newDiscount !== oldDiscount;

    let newCouponId = affiliate.stripeCouponId;
    let newPromotionCodeId = affiliate.stripePromotionCodeId;

    if (discountChanged) {
      // Remove cupom antigo (se existir)
      if (affiliate.stripeCouponId || affiliate.stripePromotionCodeId) {
        await this.stripeService.removeAffiliateCoupon(
          affiliate.stripeCouponId,
          affiliate.stripePromotionCodeId,
        );
        newCouponId = null;
        newPromotionCodeId = null;
      }
      // Cria novo (se desconto > 0)
      if (newDiscount && newDiscount > 0) {
        const created = await this.stripeService.createAffiliateCoupon(
          affiliate.id,
          affiliate.code,
          newDiscount,
        );
        newCouponId = created.couponId;
        newPromotionCodeId = created.promotionCodeId;
      }
    }

    return this.prisma.affiliate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.commissionPercent !== undefined && { commissionPercent: dto.commissionPercent }),
        ...(dto.userId !== undefined && { userId: dto.userId || null }),
        ...(discountProvided && { discountPercent: newDiscount ?? null }),
        ...(dto.discountAppliesTo !== undefined && { discountAppliesTo: dto.discountAppliesTo }),
        ...(discountChanged && {
          stripeCouponId: newCouponId,
          stripePromotionCodeId: newPromotionCodeId,
        }),
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

    const nextActive = !affiliate.isActive;

    // Ativa/desativa promotion code no Stripe junto com o afiliado
    if (affiliate.stripePromotionCodeId) {
      await this.stripeService.setAffiliatePromotionCodeActive(
        affiliate.stripePromotionCodeId,
        nextActive,
      );
    }

    return this.prisma.affiliate.update({
      where: { id },
      data: { isActive: nextActive },
    });
  }

  async remove(id: string) {
    const affiliate = await this.prisma.affiliate.findUnique({
      where: { id },
      include: { _count: { select: { earnings: true } } },
    });
    if (!affiliate) {
      throw new NotFoundException('Afiliado não encontrado');
    }

    await this.prisma.affiliate.delete({ where: { id } });

    return {
      id,
      code: affiliate.code,
      deletedEarnings: affiliate._count.earnings,
    };
  }

  async createForUser(userId: string, dto: UpdatePixKeyDto) {
    const existing = await this.prisma.affiliate.findFirst({
      where: { userId },
    });
    if (existing) {
      throw new ConflictException('Você já possui um link de afiliado');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const displayName = user.name?.trim() || user.email.split('@')[0];

    for (let attempt = 0; attempt < 8; attempt++) {
      const code = this.buildAffiliateCodeCandidate(user.name, user.email, attempt);
      try {
        return await this.prisma.affiliate.create({
          data: {
            name: displayName,
            code,
            commissionPercent: 20,
            userId,
            pixKey: dto.pixKey.trim(),
            pixKeyType: dto.pixKeyType as PixKeyType,
          },
        });
      } catch (err: unknown) {
        if (this.isUniqueConstraintError(err)) continue;
        throw err;
      }
    }

    throw new ConflictException('Não foi possível gerar um código único, tente novamente');
  }

  async updateMyPixKey(userId: string, dto: UpdatePixKeyDto) {
    const affiliate = await this.prisma.affiliate.findFirst({
      where: { userId },
    });
    if (!affiliate) {
      throw new NotFoundException('Você ainda não é afiliado');
    }

    return this.prisma.affiliate.update({
      where: { id: affiliate.id },
      data: {
        pixKey: dto.pixKey.trim(),
        pixKeyType: dto.pixKeyType as PixKeyType,
      },
      select: {
        id: true,
        pixKey: true,
        pixKeyType: true,
      },
    });
  }

  private buildAffiliateCodeCandidate(name: string, email: string, attempt: number): string {
    const base =
      (name || email.split('@')[0])
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase()
        .slice(0, 12) || 'USER';

    // First try: clean code. After that: append 4-digit random suffix to break collisions.
    const suffix = attempt === 0 ? '' : Math.floor(1000 + Math.random() * 9000).toString();
    return `${base}${suffix}`.slice(0, 20);
  }

  private isUniqueConstraintError(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: unknown }).code === 'P2002'
    );
  }

  async getMyAffiliate(userId: string) {
    const affiliate = await this.prisma.affiliate.findFirst({
      where: { userId },
    });

    if (!affiliate) {
      return null;
    }

    const maturationDate = new Date();
    maturationDate.setDate(maturationDate.getDate() - 30);

    // Saldos são apurados por moeda: somar BRL com USD produziria um número
    // sem significado. A conversão para BRL acontece só no saque.
    const summaryByCurrency = await this.aggregateByCurrency(
      { affiliateId: affiliate.id },
      maturationDate,
    );

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
        currency: true,
        status: true,
        paidAt: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
        payment: {
          select: {
            type: true,
            amountCents: true,
            currency: true,
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
        discountPercent: affiliate.discountPercent,
        discountAppliesTo: affiliate.discountAppliesTo,
        pixKey: affiliate.pixKey,
        pixKeyType: affiliate.pixKeyType,
        createdAt: affiliate.createdAt,
      },
      summary: {
        referredUsers,
        maturationDays: 30,
        /** um bloco de saldos por moeda; nunca somar entre si */
        byCurrency: summaryByCurrency,
      },
      earnings,
    };
  }

  /**
   * Apura os saldos de um afiliado (ou de um recorte qualquer de earnings)
   * agrupados por moeda. Retorna sempre pelo menos um bloco quando há registros.
   */
  private async aggregateByCurrency(
    where: Prisma.AffiliateEarningWhereInput,
    maturationDate: Date,
  ): Promise<CurrencySummary[]> {
    const rows = await this.prisma.affiliateEarning.groupBy({
      by: ['currency', 'status'],
      where,
      _sum: { commissionCents: true, amountCents: true },
      _count: { _all: true },
    });

    // "disponível" e "a liberar" dependem da data de maturação, que o groupBy
    // acima não recorta — daí a segunda passada só sobre os PENDING
    const pendingRows = await this.prisma.affiliateEarning.groupBy({
      by: ['currency'],
      where: { ...where, status: 'PENDING', createdAt: { lte: maturationDate } },
      _sum: { commissionCents: true },
    });
    const availableByCurrency = new Map(
      pendingRows.map((r) => [r.currency, r._sum.commissionCents ?? 0]),
    );

    const byCurrency = new Map<string, CurrencySummary>();
    for (const row of rows) {
      const entry = byCurrency.get(row.currency) ?? emptySummary(row.currency);
      const commission = row._sum.commissionCents ?? 0;

      entry.totalPayments += row._count._all;
      entry.totalRevenueCents += row._sum.amountCents ?? 0;
      entry.totalCommissionCents += commission;
      if (row.status === 'PENDING') entry.pendingCommissionCents += commission;
      if (row.status === 'PAID') entry.paidCommissionCents += commission;

      byCurrency.set(row.currency, entry);
    }

    for (const entry of byCurrency.values()) {
      entry.availableCommissionCents = availableByCurrency.get(entry.currency) ?? 0;
      entry.maturingCommissionCents =
        entry.pendingCommissionCents - entry.availableCommissionCents;
    }

    // BRL primeiro, depois as demais em ordem alfabética
    return [...byCurrency.values()].sort((a, b) =>
      a.currency === b.currency ? 0 : a.currency === 'BRL' ? -1 : b.currency === 'BRL' ? 1 : a.currency.localeCompare(b.currency),
    );
  }

  async getReferredUsers(affiliateId: string) {
    const affiliate = await this.prisma.affiliate.findUnique({
      where: { id: affiliateId },
    });
    if (!affiliate) {
      throw new NotFoundException('Afiliado não encontrado');
    }

    const users = await this.prisma.user.findMany({
      where: { referredByCode: affiliate.code },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        subscriptions: {
          where: { status: 'ACTIVE' },
          take: 1,
          select: {
            plan: { select: { name: true, slug: true } },
          },
        },
      },
    });

    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      createdAt: u.createdAt,
      plan: u.subscriptions[0]?.plan?.name ?? 'Free',
    }));
  }

  async getDashboard() {
    const totalAffiliates = await this.prisma.affiliate.count();
    const activeAffiliates = await this.prisma.affiliate.count({
      where: { isActive: true },
    });

    const maturationDate = new Date();
    maturationDate.setDate(maturationDate.getDate() - 30);

    const referredUsers = await this.prisma.user.count({
      where: { referredByCode: { not: null } },
    });

    return {
      totalAffiliates,
      activeAffiliates,
      referredUsers,
      byCurrency: await this.aggregateByCurrency({}, maturationDate),
    };
  }
}
