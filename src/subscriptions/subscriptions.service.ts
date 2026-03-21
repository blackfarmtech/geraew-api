import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlansService } from '../plans/plans.service';
import { StripeService } from '../payments/stripe.service';
import { SubscriptionResponseDto } from './dto/subscription-response.dto';

const PLAN_ORDER = ['free', 'starter', 'pro', 'business'];

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plansService: PlansService,
    private readonly stripeService: StripeService,
  ) {}

  async getCurrentSubscription(
    userId: string,
  ): Promise<SubscriptionResponseDto | null> {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: ['ACTIVE', 'PAST_DUE', 'TRIALING'] },
      },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    });

    if (!subscription) {
      return null;
    }

    return this.toResponseDto(subscription);
  }

  /**
   * Cria Stripe Checkout Session para assinatura.
   * A subscription local é criada apenas no webhook checkout.session.completed.
   */
  async createSubscription(
    userId: string,
    planSlug: string,
  ): Promise<{ checkoutUrl: string }> {
    const plan = await this.plansService.findPlanBySlug(planSlug);

    if (plan.slug === 'free') {
      throw new BadRequestException(
        'Não é possível criar assinatura para o plano Free',
      );
    }

    const existing = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: ['ACTIVE', 'TRIALING'] },
        plan: { slug: { not: 'free' } },
      },
      include: { plan: true },
    });

    if (existing) {
      throw new ConflictException(
        'Usuário já possui uma assinatura ativa. Use upgrade ou downgrade.',
      );
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true, name: true },
    });

    const customerId = await this.stripeService.getOrCreateCustomer(
      userId,
      user.email,
      user.name,
    );

    const checkoutUrl = await this.stripeService.createSubscriptionCheckout(
      customerId,
      plan.slug,
      plan.name,
      plan.priceCents,
      userId,
      plan.stripePriceId,
    );

    return { checkoutUrl };
  }

  async upgrade(
    userId: string,
    planSlug: string,
  ): Promise<SubscriptionResponseDto> {
    const current = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: ['ACTIVE', 'TRIALING'] },
      },
      include: { plan: true },
    });

    if (!current) {
      throw new NotFoundException('Nenhuma assinatura ativa encontrada');
    }

    const newPlan = await this.plansService.findPlanBySlug(planSlug);

    const currentIdx = PLAN_ORDER.indexOf(current.plan.slug);
    const newIdx = PLAN_ORDER.indexOf(newPlan.slug);

    if (newIdx <= currentIdx) {
      throw new BadRequestException(
        `O plano "${newPlan.slug}" não é superior ao plano atual "${current.plan.slug}". Use downgrade.`,
      );
    }

    // Upgrade paid → paid via Stripe. Free → paid deve usar createSubscription (checkout).
    if (current.plan.slug === 'free' || !current.externalSubscriptionId) {
      throw new BadRequestException(
        'Para sair do plano Free, crie uma nova assinatura via checkout.',
      );
    }

    if (!newPlan.stripePriceId) {
      throw new BadRequestException(
        `O plano "${newPlan.slug}" não possui preço configurado no Stripe.`,
      );
    }

    // Buscar stripeCustomerId do usuário
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });

    if (!user.stripeCustomerId) {
      throw new BadRequestException(
        'Usuário não possui customer no Stripe.',
      );
    }

    // Chamar Stripe: cria nova sub com cupom (cobra diferença) e cancela antiga.
    // Se falhar (ex: cartão recusado), nada muda localmente.
    let stripeResult: {
      stripeSubscriptionId: string;
      invoiceId: string | null;
    };

    try {
      stripeResult = await this.stripeService.upgradeSubscription(
        user.stripeCustomerId,
        current.externalSubscriptionId,
        newPlan.stripePriceId,
        newPlan.name,
        current.plan.priceCents,
        userId,
        newPlan.slug,
      );
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : 'Erro desconhecido';
      throw new BadRequestException(
        `Falha ao processar pagamento do upgrade: ${msg}`,
      );
    }

    // Atualizar banco local em transação atômica
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const diffCents = newPlan.priceCents - current.plan.priceCents;

    const subscription = await this.prisma.$transaction(async (tx) => {
      // Atualizar subscription: novo plano, novo Stripe ID, resetar ciclo
      const sub = await tx.subscription.update({
        where: { id: current.id },
        data: {
          planId: newPlan.id,
          externalSubscriptionId: stripeResult.stripeSubscriptionId,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
          paymentRetryCount: 0,
        },
        include: { plan: true },
      });

      // Créditos cheios do novo plano, preservando bonus
      await tx.creditBalance.upsert({
        where: { userId },
        create: {
          userId,
          planCreditsRemaining: newPlan.creditsPerMonth,
          bonusCreditsRemaining: 0,
          planCreditsUsed: 0,
          periodStart: now,
          periodEnd: periodEnd,
        },
        update: {
          planCreditsRemaining: newPlan.creditsPerMonth,
          planCreditsUsed: 0,
          periodStart: now,
          periodEnd: periodEnd,
        },
      });

      // Registrar pagamento
      const payment = await tx.payment.create({
        data: {
          userId,
          type: 'SUBSCRIPTION',
          amountCents: diffCents,
          currency: 'BRL',
          status: 'COMPLETED',
          provider: 'stripe',
          externalPaymentId:
            stripeResult.invoiceId ??
            stripeResult.stripeSubscriptionId,
          subscriptionId: current.id,
          metadata: {
            type: 'subscription_upgrade',
            fromPlan: current.plan.slug,
            toPlan: newPlan.slug,
          },
        },
      });

      // Registrar transação de créditos
      await tx.creditTransaction.create({
        data: {
          userId,
          type: 'SUBSCRIPTION_RENEWAL',
          amount: newPlan.creditsPerMonth,
          source: 'plan',
          description: `Upgrade de ${current.plan.name} para ${newPlan.name} — ${newPlan.creditsPerMonth} créditos`,
          paymentId: payment.id,
        },
      });

      return sub;
    });

    return this.toResponseDto(subscription);
  }

  async downgrade(
    userId: string,
    planSlug: string,
  ): Promise<SubscriptionResponseDto> {
    const current = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: ['ACTIVE', 'TRIALING'] },
      },
      include: { plan: true },
    });

    if (!current) {
      throw new NotFoundException('Nenhuma assinatura ativa encontrada');
    }

    const newPlan = await this.plansService.findPlanBySlug(planSlug);

    const currentIdx = PLAN_ORDER.indexOf(current.plan.slug);
    const newIdx = PLAN_ORDER.indexOf(newPlan.slug);

    if (newIdx >= currentIdx) {
      throw new BadRequestException(
        `O plano "${newPlan.slug}" não é inferior ao plano atual "${current.plan.slug}". Use upgrade.`,
      );
    }

    const subscription = await this.prisma.subscription.update({
      where: { id: current.id },
      data: {
        cancelAtPeriodEnd: true,
      },
      include: { plan: true },
    });

    return this.toResponseDto(subscription);
  }

  async cancel(userId: string): Promise<SubscriptionResponseDto> {
    const current = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
      },
      include: { plan: true },
    });

    if (!current) {
      throw new NotFoundException('Nenhuma assinatura ativa encontrada');
    }

    if (current.cancelAtPeriodEnd) {
      throw new BadRequestException('Assinatura já está marcada para cancelamento');
    }

    // Cancelar no Stripe (cancel_at_period_end)
    if (current.externalSubscriptionId) {
      await this.stripeService.cancelSubscription(
        current.externalSubscriptionId,
      );
    }

    const subscription = await this.prisma.subscription.update({
      where: { id: current.id },
      data: { cancelAtPeriodEnd: true },
      include: { plan: true },
    });

    return this.toResponseDto(subscription);
  }

  async reactivate(userId: string): Promise<SubscriptionResponseDto> {
    const current = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        cancelAtPeriodEnd: true,
      },
      include: { plan: true },
    });

    if (!current) {
      throw new NotFoundException(
        'Nenhuma assinatura ativa com cancelamento pendente encontrada',
      );
    }

    // Reativar no Stripe
    if (current.externalSubscriptionId) {
      await this.stripeService.reactivateSubscription(
        current.externalSubscriptionId,
      );
    }

    const subscription = await this.prisma.subscription.update({
      where: { id: current.id },
      data: { cancelAtPeriodEnd: false },
      include: { plan: true },
    });

    return this.toResponseDto(subscription);
  }

  private toResponseDto(
    subscription: any,
  ): SubscriptionResponseDto {
    return {
      id: subscription.id,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      paymentProvider: subscription.paymentProvider,
      paymentRetryCount: subscription.paymentRetryCount,
      createdAt: subscription.createdAt,
      plan: {
        id: subscription.plan.id,
        slug: subscription.plan.slug,
        name: subscription.plan.name,
        priceCents: subscription.plan.priceCents,
        creditsPerMonth: subscription.plan.creditsPerMonth,
        maxConcurrentGenerations: subscription.plan.maxConcurrentGenerations,
        hasWatermark: subscription.plan.hasWatermark,
        galleryRetentionDays: subscription.plan.galleryRetentionDays,
        hasApiAccess: subscription.plan.hasApiAccess,
      },
    };
  }
}
