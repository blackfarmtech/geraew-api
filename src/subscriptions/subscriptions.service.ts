import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlansService } from '../plans/plans.service';
import { StripeService } from '../payments/stripe.service';
import { CreditsService } from '../credits/credits.service';
import { SubscriptionResponseDto } from './dto/subscription-response.dto';

const PLAN_ORDER = ['free', 'starter', 'creator', 'pro', 'studio'];

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly plansService: PlansService,
    private readonly stripeService: StripeService,
    private readonly creditsService: CreditsService,
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
      include: { plan: true, scheduledPlan: true },
    });

    if (!subscription) {
      return null;
    }

    const dto = this.toResponseDto(subscription);

    // Fetch active discount from Stripe
    if (subscription.externalSubscriptionId) {
      const discount = await this.stripeService.getSubscriptionDiscount(
        subscription.externalSubscriptionId,
      ).catch(() => null);
      if (discount) {
        dto.discount = discount;
      }
    }

    return dto;
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

      // Desconto = valor real que o usuario esta pagando no plano atual
      // Se tem desconto de retencao ativo, usar o valor com desconto (nao o preco cheio)
      if (newIdx > currentIdx && current.plan.slug !== 'free') {
        let actualPriceCents = current.plan.priceCents;

        if (current.externalSubscriptionId) {
          const discount = await this.stripeService.getSubscriptionDiscount(
            current.externalSubscriptionId,
          ).catch(() => null);

          if (discount?.percentOff && discount.remainingMonths && discount.remainingMonths > 0) {
            actualPriceCents = Math.round(
              current.plan.priceCents * (1 - discount.percentOff / 100),
            );
          } else if (discount?.amountOffCents && discount.remainingMonths && discount.remainingMonths > 0) {
            actualPriceCents = Math.max(
              0,
              current.plan.priceCents - discount.amountOffCents,
            );
          }
        }

        discountAmountCents = actualPriceCents;
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

    // If a paid downgrade was pending, revert the Stripe price before canceling
    if (current.scheduledPlanId && current.externalSubscriptionId && current.plan.stripePriceId) {
      await this.stripeService.scheduleSubscriptionPlanChange(
        current.externalSubscriptionId,
        current.plan.stripePriceId,
      );
    }

    // Cancelar no Stripe (cancel_at_period_end)
    if (current.externalSubscriptionId) {
      await this.stripeService.cancelSubscription(
        current.externalSubscriptionId,
      );
    }

    const subscription = await this.prisma.subscription.update({
      where: { id: current.id },
      data: { cancelAtPeriodEnd: true, scheduledPlanId: null },
      include: { plan: true, scheduledPlan: true },
    });

    return this.toResponseDto(subscription);
  }

  async pause(userId: string, durationDays = 30): Promise<SubscriptionResponseDto> {
    const current = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        cancelAtPeriodEnd: false,
        pausedUntil: null,
      },
      include: { plan: true },
    });

    if (!current) {
      throw new NotFoundException(
        'Nenhuma assinatura ativa encontrada para pausar',
      );
    }

    if (current.plan.slug === 'free') {
      throw new BadRequestException('Nao e possivel pausar o plano Free');
    }

    const resumesAt = new Date();
    resumesAt.setDate(resumesAt.getDate() + durationDays);

    // Pausar no Stripe
    if (current.externalSubscriptionId) {
      await this.stripeService.pauseSubscription(
        current.externalSubscriptionId,
        resumesAt,
      );
    }

    const subscription = await this.prisma.subscription.update({
      where: { id: current.id },
      data: { pausedUntil: resumesAt },
      include: { plan: true },
    });

    return this.toResponseDto(subscription);
  }

  async cancelDowngrade(userId: string): Promise<SubscriptionResponseDto> {
    const current = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        scheduledPlanId: { not: null },
      },
      include: { plan: true, scheduledPlan: true },
    });

    if (!current || !current.scheduledPlanId) {
      throw new NotFoundException(
        'Nenhum downgrade agendado encontrado',
      );
    }

    // If downgrade to free (cancel at period end), revert the cancellation in Stripe
    if (current.cancelAtPeriodEnd && current.externalSubscriptionId) {
      await this.stripeService.reactivateSubscription(
        current.externalSubscriptionId,
      );
    }

    // If downgrade to a paid plan, revert the Stripe price back to the current plan
    if (!current.cancelAtPeriodEnd && current.externalSubscriptionId && current.plan.stripePriceId) {
      await this.stripeService.scheduleSubscriptionPlanChange(
        current.externalSubscriptionId,
        current.plan.stripePriceId,
      );
    }

    const subscription = await this.prisma.subscription.update({
      where: { id: current.id },
      data: {
        scheduledPlanId: null,
        cancelAtPeriodEnd: false,
      },
      include: { plan: true, scheduledPlan: true },
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

    // If there was a pending downgrade, revert Stripe price back to current plan
    if (current.scheduledPlanId && current.externalSubscriptionId && current.plan.stripePriceId) {
      await this.stripeService.scheduleSubscriptionPlanChange(
        current.externalSubscriptionId,
        current.plan.stripePriceId,
      );
    }

    const subscription = await this.prisma.subscription.update({
      where: { id: current.id },
      data: { cancelAtPeriodEnd: false, scheduledPlanId: null },
      include: { plan: true, scheduledPlan: true },
    });

    return this.toResponseDto(subscription);
  }

  async acceptOffer(
    userId: string,
    reason: string,
  ): Promise<{ offerType: string; detail: string }> {
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

    if (current.plan.slug === 'free') {
      throw new BadRequestException('Plano Free nao possui ofertas de retencao');
    }

    // Nao permitir oferta em sub ja marcada para cancelamento
    if (current.cancelAtPeriodEnd) {
      throw new BadRequestException(
        'Nao e possivel aceitar oferta em assinatura marcada para cancelamento.',
      );
    }

    // Nao permitir oferta em sub pausada
    if (current.pausedUntil) {
      throw new BadRequestException(
        'Nao e possivel aceitar oferta em assinatura pausada.',
      );
    }

    // Cada assinatura permite apenas 1 oferta de retencao
    if (current.retentionOfferAcceptedAt) {
      throw new BadRequestException(
        'Voce ja aceitou uma oferta de retencao nesta assinatura.',
      );
    }

    // Marcar ANTES de aplicar (previne race condition em requests concorrentes)
    // updateMany com WHERE atomico garante que apenas 1 request passa
    const claimed = await this.prisma.subscription.updateMany({
      where: {
        id: current.id,
        retentionOfferAcceptedAt: null,
      },
      data: { retentionOfferAcceptedAt: new Date() },
    });

    if (claimed.count === 0) {
      throw new BadRequestException(
        'Voce ja aceitou uma oferta de retencao nesta assinatura.',
      );
    }

    let result: { offerType: string; detail: string };

    try {
      switch (reason) {
        case 'expensive': {
          // 15% OFF por 2 meses
          if (!current.externalSubscriptionId) {
            throw new BadRequestException('Assinatura sem vinculo com Stripe');
          }
          await this.stripeService.applyRetentionDiscount(
            current.externalSubscriptionId,
            15,
            2,
            userId,
            reason,
          );
          this.logger.log(`Retention offer accepted: 15% OFF 2 months for user ${userId}`);
          result = { offerType: 'discount', detail: '15% OFF por 2 meses aplicado' };
          break;
        }

        case 'not_using': {
          // +50 creditos bonus
          await this.creditsService.addBonusCredits(
            userId,
            50,
            'Bonus de retencao: +50 creditos para explorar a plataforma',
          );
          this.logger.log(`Retention offer accepted: +50 bonus credits for user ${userId}`);
          result = { offerType: 'bonus_credits', detail: '+50 creditos bonus adicionados' };
          break;
        }

        case 'quality': {
          // +30 creditos bonus
          await this.creditsService.addBonusCredits(
            userId,
            30,
            'Bonus de retencao: +30 creditos para testar melhorias',
          );
          this.logger.log(`Retention offer accepted: +30 bonus credits for user ${userId}`);
          result = { offerType: 'bonus_credits', detail: '+30 creditos bonus adicionados' };
          break;
        }

        case 'competitor': {
          // +100 creditos bonus para comparar
          await this.creditsService.addBonusCredits(
            userId,
            100,
            'Bonus de retencao: +100 creditos para comparar com concorrentes',
          );
          this.logger.log(`Retention offer accepted: +100 bonus credits for user ${userId}`);
          result = { offerType: 'bonus_credits', detail: '+100 creditos bonus adicionados' };
          break;
        }

        case 'temporary': {
          // Pausa de 30 dias (ja implementado via pause())
          await this.pause(userId);
          result = { offerType: 'pause', detail: 'Assinatura pausada por 30 dias' };
          break;
        }

        default: {
          // 20% OFF na proxima renovacao
          if (!current.externalSubscriptionId) {
            throw new BadRequestException('Assinatura sem vinculo com Stripe');
          }
          await this.stripeService.applyRetentionDiscount(
            current.externalSubscriptionId,
            20,
            1,
            userId,
            reason,
          );
          this.logger.log(`Retention offer accepted: 20% OFF next renewal for user ${userId}`);
          result = { offerType: 'discount', detail: '20% OFF na proxima renovacao aplicado' };
          break;
        }
      }
    } catch (error) {
      // Rollback: se a aplicacao falhar, limpar o claim para permitir nova tentativa
      await this.prisma.subscription.update({
        where: { id: current.id },
        data: { retentionOfferAcceptedAt: null },
      });
      throw error;
    }

    return result;
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
      pausedUntil: subscription.pausedUntil ?? null,
      retentionOfferAcceptedAt: subscription.retentionOfferAcceptedAt ?? null,
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
