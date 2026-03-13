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
  ): Promise<EstimateCostResponseDto> {
    const creditsRequired = await this.plansService.calculateGenerationCost(
      type,
      resolution,
      durationSeconds,
      hasAudio,
      sampleCount,
    );

    const balance = await this.getBalance(userId);

    return {
      creditsRequired,
      hasSufficientBalance: balance.totalCreditsAvailable >= creditsRequired,
    };
  }

  async debit(
    userId: string,
    amount: number,
    type: CreditTransactionType,
    generationId?: string,
    description?: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const balance = await tx.creditBalance.findUnique({
        where: { userId },
      });

      if (!balance) {
        throw new NotFoundException('Saldo de créditos não encontrado');
      }

      const totalAvailable =
        balance.planCreditsRemaining + balance.bonusCreditsRemaining;

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

      if (balance.planCreditsRemaining >= remainingDebit) {
        planDebit = remainingDebit;
        remainingDebit = 0;
      } else {
        planDebit = balance.planCreditsRemaining;
        remainingDebit -= planDebit;
        bonusDebit = remainingDebit;
      }

      await tx.creditBalance.update({
        where: { userId },
        data: {
          planCreditsRemaining: balance.planCreditsRemaining - planDebit,
          bonusCreditsRemaining: balance.bonusCreditsRemaining - bonusDebit,
          planCreditsUsed: balance.planCreditsUsed + planDebit,
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

      const balance = await tx.creditBalance.findUnique({
        where: { userId },
      });

      if (!balance) {
        throw new NotFoundException('Saldo de créditos não encontrado');
      }

      await tx.creditBalance.update({
        where: { userId },
        data: {
          planCreditsRemaining: balance.planCreditsRemaining + planRefund,
          bonusCreditsRemaining: balance.bonusCreditsRemaining + bonusRefund,
          planCreditsUsed: balance.planCreditsUsed - planRefund,
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
}
