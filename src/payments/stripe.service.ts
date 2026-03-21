import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.stripe = new Stripe(
      this.configService.getOrThrow<string>('STRIPE_SECRET_KEY'),
      { apiVersion: '2026-02-25.clover' },
    );
    this.webhookSecret =
      this.configService.get<string>('STRIPE_WEBHOOK_SECRET') ?? '';
  }

  /**
   * Busca stripeCustomerId do user. Se não existir, cria no Stripe e salva no banco.
   */
  async getOrCreateCustomer(
    userId: string,
    email: string,
    name: string,
  ): Promise<string> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });

    if (user.stripeCustomerId) {
      return user.stripeCustomerId;
    }

    const customer = await this.stripe.customers.create({
      email,
      name,
      metadata: { userId },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customer.id },
    });

    this.logger.log(
      `Created Stripe customer ${customer.id} for user ${userId}`,
    );

    return customer.id;
  }

  /**
   * Cria Checkout Session mode=subscription para assinatura de plano.
   * Usa o stripePriceId do banco quando disponível; cria price inline como fallback.
   */
  async createSubscriptionCheckout(
    customerId: string,
    planSlug: string,
    planName: string,
    priceCents: number,
    userId: string,
    stripePriceId?: string | null,
  ): Promise<string> {
    const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = stripePriceId
      ? { price: stripePriceId, quantity: 1 }
      : {
          price_data: {
            currency: 'brl',
            product_data: {
              name: `GeraEW — Plano ${planName}`,
              description: `Assinatura mensal do plano ${planName}`,
            },
            unit_amount: priceCents,
            recurring: { interval: 'month' },
          },
          quantity: 1,
        };

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [lineItem],
      metadata: {
        userId,
        planSlug,
        type: 'subscription',
      },
      subscription_data: {
        metadata: {
          userId,
          planSlug,
        },
      },
      success_url: this.configService.get<string>('STRIPE_SUCCESS_URL') ??
        'http://localhost:3000/payment/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: this.configService.get<string>('STRIPE_CANCEL_URL') ??
        'http://localhost:3000/payment/cancel',
    });

    return session.url!;
  }

  /**
   * Cria Checkout Session mode=payment para compra avulsa de créditos.
   * Usa o stripePriceId do banco quando disponível; cria price inline como fallback.
   */
  async createCreditPurchaseCheckout(
    customerId: string,
    packageId: string,
    packageName: string,
    credits: number,
    priceCents: number,
    userId: string,
    stripePriceId?: string | null,
  ): Promise<string> {
    const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = stripePriceId
      ? { price: stripePriceId, quantity: 1 }
      : {
          price_data: {
            currency: 'brl',
            product_data: {
              name: `GeraEW — ${packageName}`,
              description: `${credits} créditos avulsos`,
            },
            unit_amount: priceCents,
          },
          quantity: 1,
        };

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [lineItem],
      metadata: {
        userId,
        packageId,
        type: 'credit_purchase',
      },
      success_url: this.configService.get<string>('STRIPE_SUCCESS_URL') ??
        'http://localhost:3000/payment/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: this.configService.get<string>('STRIPE_CANCEL_URL') ??
        'http://localhost:3000/payment/cancel',
    });

    return session.url!;
  }

  /**
   * Verifica assinatura do webhook e retorna o evento Stripe.
   */
  constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event {
    return this.stripe.webhooks.constructEvent(
      payload,
      signature,
      this.webhookSecret,
    );
  }

  /**
   * Faz upgrade de subscription: cria nova sub com cupom (cobra só a diferença)
   * e cancela a antiga. Cria a nova ANTES de cancelar a antiga para segurança.
   */
  async upgradeSubscription(
    customerId: string,
    oldSubscriptionId: string,
    newStripePriceId: string,
    newPlanName: string,
    currentPlanPriceCents: number,
    userId: string,
    newPlanSlug: string,
  ): Promise<{ stripeSubscriptionId: string; invoiceId: string | null }> {
    // 1. Criar cupom one-time com o valor do plano atual
    //    Ex: Starter R$29,90 → cupom de R$29,90 off na primeira invoice do Pro
    const coupon = await this.stripe.coupons.create({
      amount_off: currentPlanPriceCents,
      currency: 'brl',
      duration: 'once',
      name: `Upgrade para ${newPlanName}`,
      metadata: { userId, type: 'subscription_upgrade' },
    });

    try {
      // 2. Buscar payment method da subscription existente
      const oldSub = await this.stripe.subscriptions.retrieve(oldSubscriptionId);
      const defaultPaymentMethod =
        typeof oldSub.default_payment_method === 'string'
          ? oldSub.default_payment_method
          : (oldSub.default_payment_method as Stripe.PaymentMethod)?.id ?? undefined;

      // 3. Criar nova subscription com cupom e payment method explícito
      //    Invoice = newPlanPrice - coupon = diferença
      const subscription = await this.stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: newStripePriceId }],
        discounts: [{ coupon: coupon.id }],
        default_payment_method: defaultPaymentMethod,
        payment_behavior: 'error_if_incomplete',
        metadata: {
          userId,
          planSlug: newPlanSlug,
          type: 'subscription_upgrade',
        },
      });

      // 4. Cancelar subscription antiga imediatamente
      await this.stripe.subscriptions.cancel(oldSubscriptionId);

      // 5. Cleanup: deletar cupom (já usado, evita reuso)
      await this.stripe.coupons.del(coupon.id).catch((err) => {
        this.logger.warn(
          `Failed to delete upgrade coupon ${coupon.id}: ${err instanceof Error ? err.message : err}`,
        );
      });

      const invoiceId =
        typeof subscription.latest_invoice === 'string'
          ? subscription.latest_invoice
          : (subscription.latest_invoice as Stripe.Invoice)?.id ?? null;

      this.logger.log(
        `Upgraded subscription for user ${userId}: old=${oldSubscriptionId}, new=${subscription.id}`,
      );

      return { stripeSubscriptionId: subscription.id, invoiceId };
    } catch (error) {
      // Se a criação da nova sub falhar, deletar o cupom
      await this.stripe.coupons.del(coupon.id).catch(() => {});
      throw error;
    }
  }

  /**
   * Cancela subscription no Stripe ao final do período.
   */
  async cancelSubscription(externalSubscriptionId: string): Promise<void> {
    await this.stripe.subscriptions.update(externalSubscriptionId, {
      cancel_at_period_end: true,
    });

    this.logger.log(
      `Marked Stripe subscription ${externalSubscriptionId} for cancellation at period end`,
    );
  }

  /**
   * Reativa subscription no Stripe (remove cancel_at_period_end).
   */
  async reactivateSubscription(externalSubscriptionId: string): Promise<void> {
    await this.stripe.subscriptions.update(externalSubscriptionId, {
      cancel_at_period_end: false,
    });

    this.logger.log(
      `Reactivated Stripe subscription ${externalSubscriptionId}`,
    );
  }
}
