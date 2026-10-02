import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CreditTransactionType, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CronLoggerService } from './cron-logger.service';
import { addMonths } from '../plans/billing-interval';

// Minuto 15 para não disputar com SubscriptionRenewalService (minuto 0).
const SCHEDULE = '15 * * * *';

export interface AnnualCreditRefreshSummary extends Record<string, unknown> {
  candidatos: number;
  renovadas: number;
  puladas: number;
  falhas: number;
}

/**
 * Plano anual: o usuário paga 1 vez por ano, mas os créditos do plano
 * renovam todo mês. Este cron fecha o ciclo mensal de créditos
 * (credit_balances.period_end) enquanto o ano pago ainda não acabou.
 *
 * - O último ciclo do ano termina junto com current_period_end. Depois disso
 *   quem reseta os créditos é a renovação paga (webhook Stripe / PIX), então
 *   não há crédito em dobro no 12º mês.
 * - Ciclos ancorados no início do ano pago. Se o cron ficar parado por mais
 *   de um mês, pula direto para o ciclo que contém "agora" (um único reset,
 *   sem acumular meses perdidos).
 * - Idempotente: o update é condicionado ao period_end lido — duas execuções
 *   simultâneas não creditam duas vezes.
 */
@Injectable()
export class AnnualCreditRefreshService {
  private readonly logger = new Logger(AnnualCreditRefreshService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cronLogger: CronLoggerService,
  ) {}

  @Cron(SCHEDULE)
  async handleAnnualCreditRefresh() {
    try {
      return await this.cronLogger.wrap(
        {
          cronName: 'AnnualCreditRefreshService.handleAnnualCreditRefresh',
          schedule: SCHEDULE,
        },
        () => this.run(),
      );
    } catch (error: any) {
      this.logger.error(
        `Annual credit refresh cron failed: ${error.message}`,
        error.stack,
      );
    }
  }

  async run(now: Date = new Date()): Promise<AnnualCreditRefreshSummary> {
    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        billingInterval: 'YEARLY',
        currentPeriodEnd: { gt: now },
        OR: [{ pausedUntil: null }, { pausedUntil: { lte: now } }],
        user: { creditBalance: { is: { periodEnd: { lte: now } } } },
      },
      include: {
        plan: true,
        user: { select: { creditBalance: true } },
      },
    });

    const summary: AnnualCreditRefreshSummary = {
      candidatos: subscriptions.length,
      renovadas: 0,
      puladas: 0,
      falhas: 0,
    };

    for (const subscription of subscriptions) {
      try {
        const balance = subscription.user.creditBalance;
        if (!balance?.periodEnd || subscription.plan.creditsPerMonth <= 0) {
          summary.puladas++;
          continue;
        }

        const cycle = this.cycleContaining(
          subscription.currentPeriodStart,
          subscription.currentPeriodEnd,
          now,
        );
        if (!cycle) {
          summary.puladas++;
          continue;
        }

        const credits = subscription.plan.creditsPerMonth;
        const refreshed = await this.prisma.$transaction(async (tx) => {
          const updated = await tx.creditBalance.updateMany({
            where: {
              userId: subscription.userId,
              periodEnd: balance.periodEnd,
            },
            data: {
              planCreditsRemaining: credits,
              planCreditsUsed: 0,
              periodStart: cycle.start,
              periodEnd: cycle.end,
            },
          });
          if (updated.count === 0) return false;

          await tx.creditTransaction.create({
            data: {
              userId: subscription.userId,
              type: CreditTransactionType.SUBSCRIPTION_RENEWAL,
              amount: credits,
              source: 'plan',
              description: `Créditos mensais — plano anual ${subscription.plan.name}`,
            },
          });
          return true;
        });

        if (refreshed) {
          summary.renovadas++;
          this.logger.log(
            `Créditos mensais renovados: subscription ${subscription.id} (${credits} créditos, ciclo até ${cycle.end.toISOString()})`,
          );
        } else {
          summary.puladas++;
        }
      } catch (error: any) {
        summary.falhas++;
        this.logger.error(
          `Falha ao renovar créditos mensais da subscription ${subscription.id}: ${error.message}`,
        );
      }
    }

    return summary;
  }

  /**
   * Ciclo mensal de créditos que contém `now`. Os ciclos são ancorados no
   * início do ano pago (dia 31/01 → 28/02 → 31/03…, sem "escorregar" o dia),
   * e o último termina junto com o período. null se o ano pago já acabou —
   * aí é a renovação que cuida.
   */
  private cycleContaining(
    periodStart: Date,
    periodEnd: Date,
    now: Date,
  ): { start: Date; end: Date } | null {
    if (now.getTime() >= periodEnd.getTime()) return null;

    for (let k = 0; k < 13; k++) {
      const start = addMonths(periodStart, k);
      // Fim = início do ano + (k+1) meses (e não início do ciclo + 1 mês),
      // senão 31/01 → 28/02 → 28/03 e o dia escorrega para sempre.
      const anchoredEnd = addMonths(periodStart, k + 1);
      const end =
        anchoredEnd.getTime() < periodEnd.getTime()
          ? anchoredEnd
          : new Date(periodEnd);
      if (end.getTime() > now.getTime()) {
        return start.getTime() <= now.getTime() ? { start, end } : null;
      }
    }
    return null;
  }
}
