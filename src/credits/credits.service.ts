import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlansService } from '../plans/plans.service';
import { CreditTransactionType, GenerationType, Resolution } from '@prisma/client';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { CreditBalanceResponseDto } from './dto/credit-balance-response.dto';
import { CreditTransactionResponseDto } from './dto/credit-transaction-response.dto';
import { EstimateCostResponseDto } from './dto/estimate-cost.dto';

@Injectable()
export class CreditsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plansService: PlansService,
  ) {}

  async getBalance(userId: string): Promise<CreditBalanceResponseDto> {
    const balance = await this.prisma.creditBalance.findUnique({
      where: { userId },
    });

    if (!balance) {
      return {
        planCreditsRemaining: 0,
        bonusCreditsRemaining: 0,
        totalCreditsAvailable: 0,
        planCreditsUsed: 0,
        freeVeoGenerationsRemaining: 0,
        periodStart: null,
        periodEnd: null,
      };
    }

    return {
      planCreditsRemaining: balance.planCreditsRemaining,
      bonusCreditsRemaining: balance.bonusCreditsRemaining,
      totalCreditsAvailable:
        balance.planCreditsRemaining + balance.bonusCreditsRemaining,
      planCreditsUsed: balance.planCreditsUsed,
      freeVeoGenerationsRemaining: balance.freeVeoGenerationsRemaining,
      periodStart: balance.periodStart,
      periodEnd: balance.periodEnd,
    };
  }

  async getTransactions(
    userId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<CreditTransactionResponseDto>> {
    const [transactions, total] = await Promise.all([
      this.prisma.creditTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.creditTransaction.count({
        where: { userId },
      }),
    ]);

    const data: CreditTransactionResponseDto[] = transactions.map((tx) => ({
      id: tx.id,
      type: tx.type,
      amount: tx.amount,
      source: tx.source,
      description: tx.description,
      generationId: tx.generationId,
      paymentId: tx.paymentId,
      createdAt: tx.createdAt,
    }));

    return new PaginatedResponseDto(
      data,
      total,
      pagination.page,
      pagination.limit,
    );
  }

  async getPackages() {
    return this.plansService.findAllPackages();
  }

  async estimateCost(
    userId: string,
    type: GenerationType,
    resolution: Resolution,
    durationSeconds?: number,
    hasAudio: boolean = false,
    sampleCount: number = 1,
    modelVariant?: string,
  ): Promise<EstimateCostResponseDto> {
    const creditsRequired = await this.plansService.calculateGenerationCost(
      type,
      resolution,
      durationSeconds,
      hasAudio,
      sampleCount,
      modelVariant,
    );

    const balance = await this.getBalance(userId);

    // Check if user can use a free Veo generation
    const isVeoModel = modelVariant === 'VEO_FAST' || modelVariant === 'VEO_MAX';
    const canUseFreeGeneration = isVeoModel && balance.freeVeoGenerationsRemaining > 0;

    return {
      creditsRequired,
      hasSufficientBalance: canUseFreeGeneration || balance.totalCreditsAvailable >= creditsRequired,
      canUseFreeGeneration,
      freeVeoGenerationsRemaining: balance.freeVeoGenerationsRemaining,
    };
  }

  async addBonusCredits(
    userId: string,
    amount: number,
    description: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.creditBalance.upsert({
        where: { userId },
        create: {
          userId,
          bonusCreditsRemaining: amount,
          planCreditsRemaining: 0,
          planCreditsUsed: 0,
        },
        update: {
          bonusCreditsRemaining: { increment: amount },
        },
      });

      await tx.creditTransaction.create({
        data: {
          userId,
          type: CreditTransactionType.REFERRAL_BONUS,
          amount,
          source: 'bonus',
          description,
        },
      });
    });
  }

  async debit(
    userId: string,
    amount: number,
    type: CreditTransactionType,
    generationId?: string,
    description?: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Use SELECT FOR UPDATE to prevent race conditions on concurrent debits
      const [balance] = await tx.$queryRawUnsafe<any[]>(
        `SELECT * FROM "credit_balances" WHERE "user_id" = $1 FOR UPDATE`,
        userId,
      );

      if (!balance) {
        throw new NotFoundException('Saldo de créditos não encontrado');
      }

      const totalAvailable =
        balance.plan_credits_remaining + balance.bonus_credits_remaining;

      if (totalAvailable < amount) {
        throw new BadRequestException({
          code: 'INSUFFICIENT_CREDITS',
          message: `Créditos insuficientes. Necessário: ${amount}, disponível: ${totalAvailable}.`,
          statusCode: 402,
        });
      }

      // Debit plan credits first, then bonus
      let remainingDebit = amount;
      let planDebit = 0;
      let bonusDebit = 0;

      if (balance.plan_credits_remaining >= remainingDebit) {
        planDebit = remainingDebit;
        remainingDebit = 0;
      } else {
        planDebit = balance.plan_credits_remaining;
        remainingDebit -= planDebit;
        bonusDebit = remainingDebit;
      }

      await tx.creditBalance.update({
        where: { userId },
        data: {
          planCreditsRemaining: balance.plan_credits_remaining - planDebit,
          bonusCreditsRemaining: balance.bonus_credits_remaining - bonusDebit,
          planCreditsUsed: balance.plan_credits_used + planDebit,
        },
      });

      // Create transaction record(s)
      if (planDebit > 0) {
        await tx.creditTransaction.create({
          data: {
            userId,
            type,
            amount: -planDebit,
            source: 'plan',
            description: description || `Débito de ${planDebit} créditos do plano`,
            generationId,
          },
        });
      }

      if (bonusDebit > 0) {
        await tx.creditTransaction.create({
          data: {
            userId,
            type,
            amount: -bonusDebit,
            source: 'bonus',
            description: description || `Débito de ${bonusDebit} créditos bônus`,
            generationId,
          },
        });
      }
    });
  }

  async refund(
    userId: string,
    amount: number,
    generationId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Look at the original debit transactions to know where to refund
      const debitTransactions = await tx.creditTransaction.findMany({
        where: {
          generationId,
          type: CreditTransactionType.GENERATION_DEBIT,
        },
        orderBy: { createdAt: 'asc' },
      });

      let planRefund = 0;
      let bonusRefund = 0;

      for (const debit of debitTransactions) {
        if (debit.source === 'plan') {
          planRefund += Math.abs(debit.amount);
        } else {
          bonusRefund += Math.abs(debit.amount);
        }
      }

      // If no debit records found, refund to bonus credits as fallback
      if (debitTransactions.length === 0) {
        bonusRefund = amount;
      }

      // Use SELECT FOR UPDATE to prevent race conditions on concurrent refunds
      const [balance] = await tx.$queryRawUnsafe<any[]>(
        `SELECT * FROM "credit_balances" WHERE "user_id" = $1 FOR UPDATE`,
        userId,
      );

      if (!balance) {
        throw new NotFoundException('Saldo de créditos não encontrado');
      }

      await tx.creditBalance.update({
        where: { userId },
        data: {
          planCreditsRemaining: balance.plan_credits_remaining + planRefund,
          bonusCreditsRemaining: balance.bonus_credits_remaining + bonusRefund,
          planCreditsUsed: balance.plan_credits_used - planRefund,
        },
      });

      if (planRefund > 0) {
        await tx.creditTransaction.create({
          data: {
            userId,
            type: CreditTransactionType.GENERATION_REFUND,
            amount: planRefund,
            source: 'plan',
            description: `Estorno de ${planRefund} créditos do plano`,
            generationId,
          },
        });
      }

      if (bonusRefund > 0) {
        await tx.creditTransaction.create({
          data: {
            userId,
            type: CreditTransactionType.GENERATION_REFUND,
            amount: bonusRefund,
            source: 'bonus',
            description: `Estorno de ${bonusRefund} créditos bônus`,
            generationId,
          },
        });
      }
    });
  }

  async hasFreeVeoGenerations(userId: string): Promise<boolean> {
    const balance = await this.prisma.creditBalance.findUnique({
      where: { userId },
      select: { freeVeoGenerationsRemaining: true },
    });
    return (balance?.freeVeoGenerationsRemaining ?? 0) > 0;
  }

  async consumeFreeVeoGeneration(
    userId: string,
    generationId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const [balance] = await tx.$queryRawUnsafe<any[]>(
        `SELECT * FROM "credit_balances" WHERE "user_id" = $1 FOR UPDATE`,
        userId,
      );

      if (!balance || balance.free_veo_generations_remaining <= 0) {
        throw new BadRequestException({
          code: 'NO_FREE_GENERATIONS',
          message: 'Nenhuma geração gratuita disponível.',
        });
      }

      await tx.creditBalance.update({
        where: { userId },
        data: {
          freeVeoGenerationsRemaining: balance.free_veo_generations_remaining - 1,
        },
      });

      await tx.generation.update({
        where: { id: generationId },
        data: { usedFreeGeneration: true },
      });
    });
  }

  async refundFreeVeoGeneration(
    userId: string,
    generationId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const [balance] = await tx.$queryRawUnsafe<any[]>(
        `SELECT * FROM "credit_balances" WHERE "user_id" = $1 FOR UPDATE`,
        userId,
      );

      if (!balance) return;

      await tx.creditBalance.update({
        where: { userId },
        data: {
          freeVeoGenerationsRemaining: balance.free_veo_generations_remaining + 1,
        },
      });

      await tx.generation.update({
        where: { id: generationId },
        data: { usedFreeGeneration: false },
      });
    });
  }

  async partialRefund(
    userId: string,
    refundAmount: number,
    generationId: string,
    description?: string,
  ): Promise<void> {
    if (refundAmount <= 0) return;

    await this.prisma.$transaction(async (tx) => {
      const debitTransactions = await tx.creditTransaction.findMany({
        where: {
          generationId,
          type: CreditTransactionType.GENERATION_DEBIT,
        },
        orderBy: { createdAt: 'asc' },
      });

      let planRefund = 0;
      let bonusRefund = 0;

      if (debitTransactions.length > 0) {
        const totalDebited = debitTransactions.reduce(
          (sum, d) => sum + Math.abs(d.amount),
          0,
        );
        const planDebited = debitTransactions
          .filter((d) => d.source === 'plan')
          .reduce((sum, d) => sum + Math.abs(d.amount), 0);
        const bonusDebited = totalDebited - planDebited;

        // Distribute refund proportionally based on original debit ratio
        planRefund = Math.round((planDebited / totalDebited) * refundAmount);
        bonusRefund = refundAmount - planRefund;

        // Ensure we don't refund more than was debited from each source
        if (planRefund > planDebited) {
          planRefund = planDebited;
          bonusRefund = refundAmount - planRefund;
        }
        if (bonusRefund > bonusDebited) {
          bonusRefund = bonusDebited;
          planRefund = refundAmount - bonusRefund;
        }
      } else {
        bonusRefund = refundAmount;
      }

      // Use SELECT FOR UPDATE to prevent race conditions on concurrent partial refunds
      const [balance] = await tx.$queryRawUnsafe<any[]>(
        `SELECT * FROM "credit_balances" WHERE "user_id" = $1 FOR UPDATE`,
        userId,
      );

      if (!balance) {
        throw new NotFoundException('Saldo de créditos não encontrado');
      }

      await tx.creditBalance.update({
        where: { userId },
        data: {
          planCreditsRemaining: balance.plan_credits_remaining + planRefund,
          bonusCreditsRemaining: balance.bonus_credits_remaining + bonusRefund,
          planCreditsUsed: balance.plan_credits_used - planRefund,
        },
      });

      const refundDesc =
        description || `Estorno parcial de ${refundAmount} créditos`;

      if (planRefund > 0) {
        await tx.creditTransaction.create({
          data: {
            userId,
            type: CreditTransactionType.GENERATION_REFUND,
            amount: planRefund,
            source: 'plan',
            description: refundDesc,
            generationId,
          },
        });
      }

      if (bonusRefund > 0) {
        await tx.creditTransaction.create({
          data: {
            userId,
            type: CreditTransactionType.GENERATION_REFUND,
            amount: bonusRefund,
            source: 'bonus',
            description: refundDesc,
            generationId,
          },
        });
      }
    });
  }
}
