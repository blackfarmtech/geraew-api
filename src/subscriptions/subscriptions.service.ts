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

    // Calculate pro-rata credits for the remaining period
    const now = new Date();
    const periodTotal =
      current.currentPeriodEnd.getTime() -
      current.currentPeriodStart.getTime();
    const periodRemaining =
      current.currentPeriodEnd.getTime() - now.getTime();
    const remainingRatio = Math.max(0, periodRemaining / periodTotal);

    const proRataCredits = Math.floor(
      newPlan.creditsPerMonth * remainingRatio,
    );

    const subscription = await this.prisma.$transaction(async (tx) => {
      const sub = await tx.subscription.update({
        where: { id: current.id },
        data: {
          planId: newPlan.id,
          cancelAtPeriodEnd: false,
        },
        include: { plan: true },
      });

      // Update credit balance with pro-rata credits from new plan
      const balance = await tx.creditBalance.findUnique({
        where: { userId },
      });

      const currentPlanRemaining = balance?.planCreditsRemaining ?? 0;

      await tx.creditBalance.upsert({
        where: { userId },
        create: {
          userId,
          planCreditsRemaining: proRataCredits,
          bonusCreditsRemaining: 0,
          planCreditsUsed: 0,
          periodStart: current.currentPeriodStart,
          periodEnd: current.currentPeriodEnd,
        },
        update: {
          planCreditsRemaining: proRataCredits,
        },
      });

      const creditsDiff = proRataCredits - currentPlanRemaining;
      if (creditsDiff !== 0) {
        await tx.creditTransaction.create({
          data: {
            userId,
            type: 'SUBSCRIPTION_RENEWAL',
            amount: creditsDiff,
            source: 'plan',
            description: `Upgrade para ${newPlan.name} — ajuste pro-rata de créditos`,
          },
        });
      }

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
