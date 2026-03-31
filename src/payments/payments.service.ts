import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentStatus, PaymentType, Prisma } from '@prisma/client';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createPayment(
    userId: string,
    type: PaymentType,
    amountCents: number,
    provider: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    return this.prisma.payment.create({
      data: {
        userId,
        type,
        amountCents,
        provider,
        metadata: metadata ?? Prisma.JsonNull,
      },
    });
  }

  async updatePaymentStatus(
    id: string,
    status: PaymentStatus,
    externalPaymentId?: string,
  ) {
    return this.prisma.payment.update({
      where: { id },
      data: {
        status,
        ...(externalPaymentId && { externalPaymentId }),
      },
    });
  }

  async findByExternalPaymentId(externalPaymentId: string) {
    return this.prisma.payment.findFirst({
      where: { externalPaymentId },
    });
  }

  /**
   * Processa o primeiro pagamento de uma assinatura (checkout.session.completed).
   * Cria subscription local, inicializa créditos e registra payment.
   */
  async processSubscriptionPayment(
    userId: string,
    planSlug: string,
    stripeSubscriptionId: string,
    amountCents: number,
    externalPaymentId: string,
    referredByCode?: string,
  ): Promise<void> {
    const plan = await this.prisma.plan.findUnique({
      where: { slug: planSlug },
    });

    if (!plan) {
      throw new NotFoundException(`Plano "${planSlug}" não encontrado`);
    }

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await this.prisma.$transaction(async (tx) => {
      // Idempotência: check DENTRO da transaction para evitar race condition
      const existingPayment = await tx.payment.findFirst({
        where: { externalPaymentId },
      });
      if (existingPayment) {
        this.logger.log(
          `Payment ${externalPaymentId} already exists, skipping subscription creation`,
        );
        return;
      }

      // Cancelar subscriptions anteriores do usuário
      await tx.subscription.updateMany({
        where: {
          userId,
          status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] },
        },
        data: {
          status: 'CANCELED',
          cancelAtPeriodEnd: false,
        },
      });

      // Criar subscription local
      const subscription = await tx.subscription.create({
        data: {
          userId,
          planId: plan.id,
          status: 'ACTIVE',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          paymentProvider: 'stripe',
          externalSubscriptionId: stripeSubscriptionId,
        },
      });

      // Inicializar/resetar saldo de créditos
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

      // Registrar transação de créditos
      const payment = await tx.payment.create({
        data: {
          userId,
          type: 'SUBSCRIPTION',
          amountCents,
          currency: 'BRL',
          status: 'COMPLETED',
          provider: 'stripe',
          externalPaymentId,
          subscriptionId: subscription.id,
        },
      });

      await tx.creditTransaction.create({
        data: {
          userId,
          type: 'SUBSCRIPTION_RENEWAL',
          amount: plan.creditsPerMonth,
          source: 'plan',
          description: `Assinatura criada — plano ${plan.name}`,
          paymentId: payment.id,
        },
      });

      // Registrar comissão do afiliado se o usuário foi indicado
      await this.recordAffiliateEarning(tx, userId, payment.id, amountCents, referredByCode);
    });

    this.logger.log(
      `Processed subscription payment for user ${userId}, plan ${planSlug}`,
    );
  }

  /**
   * Processa compra avulsa de créditos (checkout.session.completed).
   * Adiciona bonus credits e registra payment.
   */
  async processCreditPurchase(
    userId: string,
    packageId: string,
    amountCents: number,
    externalPaymentId: string,
    referredByCode?: string,
  ): Promise<void> {
    const creditPackage = await this.prisma.creditPackage.findUnique({
      where: { id: packageId },
    });

    if (!creditPackage) {
      throw new NotFoundException(`Pacote "${packageId}" não encontrado`);
    }

    await this.prisma.$transaction(async (tx) => {
      // Idempotência: check DENTRO da transaction para evitar race condition
      const existingPayment = await tx.payment.findFirst({
        where: { externalPaymentId },
      });
      if (existingPayment) {
        this.logger.log(
          `Payment ${externalPaymentId} already exists, skipping credit purchase`,
        );
        return;
      }

      // Adicionar créditos bônus
      await tx.creditBalance.upsert({
        where: { userId },
        create: {
          userId,
          planCreditsRemaining: 0,
          bonusCreditsRemaining: creditPackage.credits,
          planCreditsUsed: 0,
        },
        update: {
          bonusCreditsRemaining: {
            increment: creditPackage.credits,
          },
        },
      });

      const payment = await tx.payment.create({
        data: {
          userId,
          type: 'CREDIT_PURCHASE',
          amountCents,
          currency: 'BRL',
          status: 'COMPLETED',
          provider: 'stripe',
          externalPaymentId,
          creditPackageId: packageId,
        },
      });

      await tx.creditTransaction.create({
        data: {
          userId,
          type: 'PURCHASE',
          amount: creditPackage.credits,
          source: 'bonus',
          description: `Compra avulsa — ${creditPackage.name} (${creditPackage.credits} créditos)`,
          paymentId: payment.id,
        },
      });

      // Registrar comissão do afiliado se o usuário foi indicado
      await this.recordAffiliateEarning(tx, userId, payment.id, amountCents, referredByCode);
    });

    this.logger.log(
      `Processed credit purchase for user ${userId}, package ${creditPackage.name}`,
    );
  }

  /**
   * Processa renovação de assinatura (invoice.payment_succeeded).
   * Renova período e reseta créditos.
   */
  async handleSubscriptionRenewal(
    stripeSubscriptionId: string,
    periodStart: Date,
    periodEnd: Date,
    amountCents: number,
    externalPaymentId: string,
  ): Promise<void> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { externalSubscriptionId: stripeSubscriptionId },
      include: { plan: true },
    });

    if (!subscription) {
      this.logger.warn(
        `Subscription not found for Stripe ID ${stripeSubscriptionId}`,
      );
      return;
    }

    // Idempotência: verificar se este pagamento já foi processado
    const existingPayment = await this.prisma.payment.findFirst({
      where: { externalPaymentId },
    });
    if (existingPayment) {
      this.logger.log(
        `Renewal payment ${externalPaymentId} already exists, skipping`,
      );
      return;
    }

    // Se tem downgrade agendado, aplicar o novo plano
    const hasScheduledPlan = !!subscription.scheduledPlanId;
    let activePlan = subscription.plan;

    if (hasScheduledPlan) {
      const scheduled = await this.prisma.plan.findUnique({
        where: { id: subscription.scheduledPlanId! },
      });
      if (scheduled) {
        activePlan = scheduled;
      } else {
        this.logger.error(
          `Scheduled plan ${subscription.scheduledPlanId} not found for subscription ${subscription.id}. ` +
          `Keeping current plan ${subscription.plan.slug} to avoid charging wrong tier.`,
        );
        // Limpar o scheduledPlanId inválido para não repetir o erro
        await this.prisma.subscription.update({
          where: { id: subscription.id },
          data: { scheduledPlanId: null },
        });
      }
    }

    await this.prisma.$transaction(async (tx) => {
      // Atualizar período da subscription (e aplicar plano agendado se houver)
      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'ACTIVE',
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          paymentRetryCount: 0,
          ...(hasScheduledPlan && {
            planId: activePlan.id,
            scheduledPlanId: null,
          }),
        },
      });

      // Resetar créditos do plano (usa o plano ativo, que pode ser o novo após downgrade)
      await tx.creditBalance.upsert({
        where: { userId: subscription.userId },
        create: {
          userId: subscription.userId,
          planCreditsRemaining: activePlan.creditsPerMonth,
          bonusCreditsRemaining: 0,
          planCreditsUsed: 0,
          periodStart,
          periodEnd,
        },
        update: {
          planCreditsRemaining: activePlan.creditsPerMonth,
          planCreditsUsed: 0,
          periodStart,
          periodEnd,
        },
      });

      const payment = await tx.payment.create({
        data: {
          userId: subscription.userId,
          type: 'SUBSCRIPTION',
          amountCents,
          currency: 'BRL',
          status: 'COMPLETED',
          provider: 'stripe',
          externalPaymentId,
          subscriptionId: subscription.id,
        },
      });

      await tx.creditTransaction.create({
        data: {
          userId: subscription.userId,
          type: 'SUBSCRIPTION_RENEWAL',
          amount: activePlan.creditsPerMonth,
          source: 'plan',
          description: hasScheduledPlan
            ? `Downgrade aplicado — plano ${activePlan.name}`
            : `Renovação mensal — plano ${activePlan.name}`,
          paymentId: payment.id,
        },
      });

      // Registrar comissão do afiliado nas renovações
      const user = await tx.user.findUnique({
        where: { id: subscription.userId },
        select: { referredByCode: true },
      });
      if (user?.referredByCode) {
        await this.recordAffiliateEarning(tx, subscription.userId, payment.id, amountCents, user.referredByCode);
      }
    });

    this.logger.log(
      `Processed subscription renewal for user ${subscription.userId}${hasScheduledPlan ? ` (downgrade to ${activePlan.slug})` : ''}`,
    );
  }

  /**
   * Processa falha de pagamento (invoice.payment_failed).
   * Marca subscription como PAST_DUE.
   */
  async handlePaymentFailed(
    stripeSubscriptionId: string,
    amountCents: number,
    externalPaymentId: string,
  ): Promise<void> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { externalSubscriptionId: stripeSubscriptionId },
    });

    if (!subscription) {
      this.logger.warn(
        `Subscription not found for Stripe ID ${stripeSubscriptionId}`,
      );
      return;
    }

    const newRetryCount = subscription.paymentRetryCount + 1;
    const maxRetries = 3;

    await this.prisma.$transaction(async (tx) => {
      if (newRetryCount >= maxRetries) {
        // Downgrade automatico apos 3 falhas: cancelar subscription
        await tx.subscription.update({
          where: { id: subscription.id },
          data: {
            status: 'CANCELED',
            paymentRetryCount: newRetryCount,
            cancelAtPeriodEnd: false,
          },
        });

        // Zerar creditos do plano
        await tx.creditBalance.updateMany({
          where: { userId: subscription.userId },
          data: { planCreditsRemaining: 0, planCreditsUsed: 0 },
        });
      } else {
        await tx.subscription.update({
          where: { id: subscription.id },
          data: {
            status: 'PAST_DUE',
            paymentRetryCount: newRetryCount,
          },
        });
      }

      await tx.payment.create({
        data: {
          userId: subscription.userId,
          type: 'SUBSCRIPTION',
          amountCents,
          currency: 'BRL',
          status: 'FAILED',
          provider: 'stripe',
          externalPaymentId,
          subscriptionId: subscription.id,
        },
      });
    });

    if (newRetryCount >= maxRetries) {
      this.logger.warn(
        `Subscription ${subscription.id} canceled after ${maxRetries} failed payment attempts`,
      );
    } else {
      this.logger.warn(
        `Payment failed for subscription ${subscription.id}, retry count: ${newRetryCount}`,
      );
    }
  }

  /**
   * Processa reembolso de pagamento (charge.refunded).
   * - Subscription: cancela e zera créditos do plano.
   * - Credit purchase: remove os créditos bônus que foram adicionados.
   */
  async handleRefund(paymentIntentId: string | null, invoiceId: string | null, amountRefundedCents: number): Promise<void> {
    const lookup = [paymentIntentId, invoiceId].filter(Boolean) as string[];

    const payment = await this.prisma.payment.findFirst({
      where: { externalPaymentId: { in: lookup } },
      include: { creditPackage: true, subscription: { include: { plan: true } } },
    });

    if (!payment) {
      this.logger.warn(`Payment not found for refund: paymentIntentId=${paymentIntentId}, invoiceId=${invoiceId}`);
      return;
    }

    if (payment.status === 'REFUNDED') {
      this.logger.log(`Payment ${payment.id} already refunded, skipping`);
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: 'REFUNDED' },
      });

      if (payment.type === 'SUBSCRIPTION' && payment.subscriptionId) {
        const freePlan = await tx.plan.findUnique({ where: { slug: 'free' } });

        await tx.subscription.update({
          where: { id: payment.subscriptionId },
          data: {
            status: 'CANCELED',
            cancelAtPeriodEnd: false,
            ...(freePlan && { planId: freePlan.id }),
          },
        });

        await tx.creditBalance.updateMany({
          where: { userId: payment.userId },
          data: { planCreditsRemaining: 0, planCreditsUsed: 0 },
        });

        await tx.creditTransaction.create({
          data: {
            userId: payment.userId,
            type: 'ADMIN_ADJUSTMENT',
            amount: -(payment.subscription?.plan?.creditsPerMonth ?? 0),
            source: 'plan',
            description: `Reembolso de assinatura — R$ ${(amountRefundedCents / 100).toFixed(2)}`,
            paymentId: payment.id,
          },
        });
      } else if (payment.type === 'CREDIT_PURCHASE' && payment.creditPackage) {
        const creditsToRemove = payment.creditPackage.credits;

        const balance = await tx.creditBalance.findUnique({ where: { userId: payment.userId } });
        const safeDeduction = Math.min(creditsToRemove, balance?.bonusCreditsRemaining ?? 0);

        await tx.creditBalance.updateMany({
          where: { userId: payment.userId },
          data: { bonusCreditsRemaining: { decrement: safeDeduction } },
        });

        await tx.creditTransaction.create({
          data: {
            userId: payment.userId,
            type: 'ADMIN_ADJUSTMENT',
            amount: -safeDeduction,
            source: 'bonus',
            description: `Reembolso de créditos — ${creditsToRemove} créditos — R$ ${(amountRefundedCents / 100).toFixed(2)}`,
            paymentId: payment.id,
          },
        });
      }
    });

    this.logger.log(`Refund processed for payment ${payment.id}, user ${payment.userId}`);
  }

  /**
   * Sincroniza estado da subscription com o Stripe (customer.subscription.updated).
   * Cobre cancelamentos e reativações feitos pelo Customer Portal.
   */
  async handleSubscriptionUpdated(
    stripeSubscriptionId: string,
    cancelAtPeriodEnd: boolean,
    stripeStatus: string,
  ): Promise<void> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { externalSubscriptionId: stripeSubscriptionId },
    });

    if (!subscription) {
      this.logger.warn(
        `Subscription not found for Stripe ID ${stripeSubscriptionId} (updated event)`,
      );
      return;
    }

    // Mapear status do Stripe para o status local (enum do Prisma)
    const statusMap: Record<string, 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'TRIALING'> = {
      active: 'ACTIVE',
      past_due: 'PAST_DUE',
      canceled: 'CANCELED',
      trialing: 'TRIALING',
    };
    const localStatus = statusMap[stripeStatus] ?? undefined;

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        cancelAtPeriodEnd,
        ...(localStatus ? { status: localStatus } : {}),
      },
    });

    this.logger.log(
      `Synced subscription ${subscription.id}: cancelAtPeriodEnd=${cancelAtPeriodEnd}, status=${stripeStatus}`,
    );
  }

  /**
   * Processa cancelamento definitivo de subscription (customer.subscription.deleted).
   * Marca como CANCELED e zera créditos do plano.
   */
  async handleSubscriptionDeleted(
    stripeSubscriptionId: string,
  ): Promise<void> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { externalSubscriptionId: stripeSubscriptionId },
    });

    if (!subscription) {
      this.logger.warn(
        `Subscription not found for Stripe ID ${stripeSubscriptionId}`,
      );
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'CANCELED',
          cancelAtPeriodEnd: false,
        },
      });

      // Só zerar créditos se NÃO existir outra subscription ativa mais recente
      // (evita zerar créditos do Pro quando a sub antiga do Starter expira)
      const newerActiveSub = await tx.subscription.findFirst({
        where: {
          userId: subscription.userId,
          status: { in: ['ACTIVE', 'TRIALING'] },
          id: { not: subscription.id },
        },
      });

      if (!newerActiveSub) {
        const balance = await tx.creditBalance.findUnique({
          where: { userId: subscription.userId },
        });

        if (balance) {
          await tx.creditBalance.update({
            where: { userId: subscription.userId },
            data: {
              planCreditsRemaining: 0,
              planCreditsUsed: 0,
            },
          });
        }
      }
    });

    this.logger.log(
      `Subscription ${subscription.id} deleted for user ${subscription.userId}`,
    );
  }

  /**
   * Registra comissão do afiliado para um pagamento.
   * Busca o afiliado pelo código, calcula a comissão e cria o registro.
   */
  private async recordAffiliateEarning(
    tx: Parameters<Parameters<typeof this.prisma.$transaction>[0]>[0],
    userId: string,
    paymentId: string,
    amountCents: number,
    referredByCode?: string,
  ): Promise<void> {
    if (!referredByCode || amountCents <= 0) return;

    const affiliate = await tx.affiliate.findUnique({
      where: { code: referredByCode },
      select: { id: true, isActive: true, commissionPercent: true },
    });

    if (!affiliate?.isActive) return;

    const commissionCents = Math.round(
      (amountCents * affiliate.commissionPercent) / 100,
    );

    if (commissionCents <= 0) return;

    await tx.affiliateEarning.create({
      data: {
        affiliateId: affiliate.id,
        paymentId,
        userId,
        amountCents,
        commissionCents,
        status: 'PENDING',
      },
    });

    this.logger.log(
      `Affiliate earning recorded: ${commissionCents} centavos for affiliate ${affiliate.id} (${affiliate.commissionPercent}% of ${amountCents})`,
    );
  }
}
