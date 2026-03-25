import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreditTransactionType, GenerationStatus, SubscriptionStatus } from '@prisma/client';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { AdminStatsResponseDto } from './dto/admin-stats-response.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(): Promise<AdminStatsResponseDto> {
    const [
      totalUsers,
      activeSubscriptions,
      revenueResult,
      totalGenerations,
      pendingCount,
      processingCount,
      completedCount,
      failedCount,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.subscription.count({
        where: { status: SubscriptionStatus.ACTIVE },
      }),
      this.prisma.payment.aggregate({
        _sum: { amountCents: true },
        where: { status: 'COMPLETED' },
      }),
      this.prisma.generation.count(),
      this.prisma.generation.count({ where: { status: GenerationStatus.PENDING } }),
      this.prisma.generation.count({ where: { status: GenerationStatus.PROCESSING } }),
      this.prisma.generation.count({ where: { status: GenerationStatus.COMPLETED } }),
      this.prisma.generation.count({ where: { status: GenerationStatus.FAILED } }),
    ]);

    return {
      totalUsers,
      activeSubscriptions,
      totalRevenueCents: revenueResult._sum.amountCents ?? 0,
      totalGenerations,
      generationsByStatus: {
        pending: pendingCount,
        processing: processingCount,
        completed: completedCount,
        failed: failedCount,
      },
    };
  }

  async getUsers(pagination: PaginationDto) {
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
        include: {
          subscriptions: {
            where: { status: SubscriptionStatus.ACTIVE },
            include: { plan: true },
            take: 1,
          },
          creditBalance: true,
        },
      }),
      this.prisma.user.count(),
    ]);

    const data = users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      subscription: user.subscriptions[0]
        ? {
            planSlug: user.subscriptions[0].plan.slug,
            planName: user.subscriptions[0].plan.name,
            status: user.subscriptions[0].status,
          }
        : null,
      credits: user.creditBalance
        ? {
            planCreditsRemaining: user.creditBalance.planCreditsRemaining,
            bonusCreditsRemaining: user.creditBalance.bonusCreditsRemaining,
          }
        : null,
    }));

    return new PaginatedResponseDto(data, total, pagination.page, pagination.limit);
  }

  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        subscriptions: {
          include: { plan: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        creditBalance: true,
        generations: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            outputs: { orderBy: { order: 'asc' as const } },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      oauthProvider: user.oauthProvider,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      subscription: user.subscriptions[0]
        ? {
            id: user.subscriptions[0].id,
            planSlug: user.subscriptions[0].plan.slug,
            planName: user.subscriptions[0].plan.name,
            status: user.subscriptions[0].status,
            currentPeriodStart: user.subscriptions[0].currentPeriodStart,
            currentPeriodEnd: user.subscriptions[0].currentPeriodEnd,
            cancelAtPeriodEnd: user.subscriptions[0].cancelAtPeriodEnd,
          }
        : null,
      credits: user.creditBalance
        ? {
            planCreditsRemaining: user.creditBalance.planCreditsRemaining,
            bonusCreditsRemaining: user.creditBalance.bonusCreditsRemaining,
            planCreditsUsed: user.creditBalance.planCreditsUsed,
            periodStart: user.creditBalance.periodStart,
            periodEnd: user.creditBalance.periodEnd,
          }
        : null,
      recentGenerations: user.generations.map((gen) => ({
        id: gen.id,
        type: gen.type,
        status: gen.status,
        prompt: gen.prompt,
        resolution: gen.resolution,
        creditsConsumed: gen.creditsConsumed,
        outputs: gen.outputs?.map((o) => ({
          url: o.url,
          thumbnailUrl: o.thumbnailUrl,
          mimeType: o.mimeType,
        })) ?? [],
        createdAt: gen.createdAt,
        completedAt: gen.completedAt,
      })),
    };
  }

  async adjustCredits(
    userId: string,
    amount: number,
    description: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    await this.prisma.$transaction(async (tx) => {
      const balance = await tx.creditBalance.findUnique({
        where: { userId },
      });

      if (!balance) {
        // Create balance if it doesn't exist
        await tx.creditBalance.create({
          data: {
            userId,
            bonusCreditsRemaining: Math.max(0, amount),
            planCreditsRemaining: 0,
            planCreditsUsed: 0,
          },
        });
      } else {
        const newBonus = balance.bonusCreditsRemaining + amount;
        await tx.creditBalance.update({
          where: { userId },
          data: {
            bonusCreditsRemaining: Math.max(0, newBonus),
          },
        });
      }

      await tx.creditTransaction.create({
        data: {
          userId,
          type: CreditTransactionType.ADMIN_ADJUSTMENT,
          amount,
          source: 'bonus',
          description,
        },
      });
    });
  }

  async changeUserPlan(userId: string, planSlug: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const plan = await this.prisma.plan.findUnique({ where: { slug: planSlug } });
    if (!plan) {
      throw new NotFoundException(`Plano "${planSlug}" não encontrado`);
    }
    if (!plan.isActive) {
      throw new BadRequestException(`Plano "${planSlug}" não está ativo`);
    }

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await this.prisma.$transaction(async (tx) => {
      // Cancel existing active subscription
      await tx.subscription.updateMany({
        where: {
          userId,
          status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE, SubscriptionStatus.TRIALING] },
        },
        data: { status: SubscriptionStatus.CANCELED },
      });

      // Create new subscription
      await tx.subscription.create({
        data: {
          userId,
          planId: plan.id,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          paymentProvider: 'admin',
        },
      });

      // Reset credits to new plan's allocation
      await tx.creditBalance.upsert({
        where: { userId },
        create: {
          userId,
          planCreditsRemaining: plan.creditsPerMonth,
          bonusCreditsRemaining: 0,
          planCreditsUsed: 0,
          periodStart: now,
          periodEnd: periodEnd,
        },
        update: {
          planCreditsRemaining: plan.creditsPerMonth,
          planCreditsUsed: 0,
          periodStart: now,
          periodEnd: periodEnd,
        },
      });

      // Log the transaction
      await tx.creditTransaction.create({
        data: {
          userId,
          type: CreditTransactionType.ADMIN_ADJUSTMENT,
          amount: plan.creditsPerMonth,
          source: 'plan',
          description: `Admin: plano alterado para ${plan.name}`,
        },
      });
    });
  }

  async getGenerations(pagination: PaginationDto) {
    const [generations, total] = await Promise.all([
      this.prisma.generation.findMany({
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
        include: {
          user: { select: { id: true, email: true, name: true } },
          outputs: { orderBy: { order: 'asc' as const } },
        },
      }),
      this.prisma.generation.count(),
    ]);

    const data = generations.map((gen) => ({
      id: gen.id,
      user: gen.user,
      type: gen.type,
      status: gen.status,
      prompt: gen.prompt,
      resolution: gen.resolution,
      durationSeconds: gen.durationSeconds,
      hasAudio: gen.hasAudio,
      creditsConsumed: gen.creditsConsumed,
      outputUrls: gen.outputs?.map((o) => o.url) ?? [],
      errorMessage: gen.errorMessage,
      processingTimeMs: gen.processingTimeMs,
      createdAt: gen.createdAt,
      completedAt: gen.completedAt,
    }));

    return new PaginatedResponseDto(data, total, pagination.page, pagination.limit);
  }

  async toggleUserStatus(userId: string, isActive: boolean): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { isActive },
      });

      // Revoke all refresh tokens when deactivating
      if (!isActive) {
        await tx.refreshToken.updateMany({
          where: { userId, revoked: false },
          data: { revoked: true },
        });
      }
    });
  }

  async deleteUser(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }
    if (user.role === 'ADMIN') {
      throw new BadRequestException('Não é possível excluir um administrador');
    }

    await this.prisma.user.delete({ where: { id: userId } });
  }

  async getUserGenerations(userId: string, pagination: PaginationDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const where = { userId };

    const [generations, total] = await Promise.all([
      this.prisma.generation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
        include: {
          outputs: { orderBy: { order: 'asc' as const } },
        },
      }),
      this.prisma.generation.count({ where }),
    ]);

    const data = generations.map((gen) => ({
      id: gen.id,
      type: gen.type,
      status: gen.status,
      prompt: gen.prompt,
      negativePrompt: gen.negativePrompt,
      resolution: gen.resolution,
      durationSeconds: gen.durationSeconds,
      hasAudio: gen.hasAudio,
      modelUsed: gen.modelUsed,
      creditsConsumed: gen.creditsConsumed,
      outputs: gen.outputs.map((o) => ({
        id: o.id,
        url: o.url,
        thumbnailUrl: o.thumbnailUrl,
        mimeType: o.mimeType,
      })),
      inputImages: [],
      isFavorited: gen.isFavorited,
      isDeleted: gen.isDeleted,
      errorMessage: gen.errorMessage,
      processingTimeMs: gen.processingTimeMs,
      createdAt: gen.createdAt,
      completedAt: gen.completedAt,
    }));

    return new PaginatedResponseDto(data, total, pagination.page, pagination.limit);
  }
}
