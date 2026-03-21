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
  ): Promise<{ checkoutUrl: string }> {
    const current = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: ['ACTIVE', 'TRIALING'] },
      },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    });

    const newPlan = await this.plansService.findPlanBySlug(planSlug);
    let discountAmountCents = 0;

    if (current) {
      const currentIdx = PLAN_ORDER.indexOf(current.plan.slug);
      const newIdx = PLAN_ORDER.indexOf(newPlan.slug);

      if (newIdx === currentIdx) {
        throw new BadRequestException('Você já está neste plano.');
      }

      // Desconto = valor do plano atual (cobrar só a diferença na primeira invoice)
      // Aplica desconto somente se o plano novo é superior ao atual e o atual é pago
      if (newIdx > currentIdx && current.plan.slug !== 'free') {
        discountAmountCents = current.plan.priceCents;
      }

      // Cancelar assinatura antiga no Stripe (soft cancel)
      if (current.externalSubscriptionId) {
        await this.stripeService.cancelSubscription(
          current.externalSubscriptionId,
        ).catch(() => {});
      }
      await this.prisma.subscription.update({
        where: { id: current.id },
        data: { cancelAtPeriodEnd: true },
      });
    }

    // Redirecionar para Stripe Checkout (com desconto se upgrade de plano pago)
    const checkoutUrl = await this.buildCheckoutForPlan(userId, planSlug, discountAmountCents);
    return { checkoutUrl };
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

    if (newIdx === currentIdx) {
      throw new BadRequestException('Você já está neste plano.');
    }

    if (newIdx > currentIdx) {
      throw new BadRequestException(
        `O plano "${newPlan.slug}" não é inferior ao atual. Use upgrade.`,
      );
    }

    // Downgrade para Free = cancelar no fim do período
    if (newPlan.slug === 'free') {
      if (current.externalSubscriptionId) {
        await this.stripeService.cancelSubscription(
          current.externalSubscriptionId,
        );
      }
      const subscription = await this.prisma.subscription.update({
        where: { id: current.id },
        data: {
          cancelAtPeriodEnd: true,
          scheduledPlanId: newPlan.id,
        },
        include: { plan: true, scheduledPlan: true },
      });
      return this.toResponseDto(subscription);
    }

    // Downgrade para plano pago inferior: atualizar price no Stripe (sem proration)
    if (!current.externalSubscriptionId) {
      throw new BadRequestException('Assinatura sem vínculo com Stripe');
    }

    if (!newPlan.stripePriceId) {
      throw new BadRequestException('Plano de destino sem price ID no Stripe');
    }

    await this.stripeService.scheduleSubscriptionPlanChange(
      current.externalSubscriptionId,
      newPlan.stripePriceId,
    );

    const subscription = await this.prisma.subscription.update({
      where: { id: current.id },
      data: { scheduledPlanId: newPlan.id },
      include: { plan: true, scheduledPlan: true },
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

  private async buildCheckoutForPlan(
    userId: string,
    planSlug: string,
    discountAmountCents = 0,
  ): Promise<string> {
    const plan = await this.plansService.findPlanBySlug(planSlug);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true, name: true },
    });
    const customerId = await this.stripeService.getOrCreateCustomer(
      userId,
      user.email,
      user.name,
    );
    return this.stripeService.createSubscriptionCheckout(
      customerId,
      plan.slug,
      plan.name,
      plan.priceCents,
      userId,
      plan.stripePriceId,
      discountAmountCents > 0 ? discountAmountCents : undefined,
    );
  }

  private toResponseDto(
    subscription: any,
  ): SubscriptionResponseDto {
    const dto: SubscriptionResponseDto = {
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

    if (subscription.scheduledPlan) {
      dto.scheduledPlan = {
        id: subscription.scheduledPlan.id,
        slug: subscription.scheduledPlan.slug,
        name: subscription.scheduledPlan.name,
        priceCents: subscription.scheduledPlan.priceCents,
        creditsPerMonth: subscription.scheduledPlan.creditsPerMonth,
      };
    }

    return dto;
  }
}
