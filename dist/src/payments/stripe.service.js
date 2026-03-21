"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var StripeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StripeService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../prisma/prisma.service");
const stripe_1 = require("stripe");
let StripeService = StripeService_1 = class StripeService {
    configService;
    prisma;
    logger = new common_1.Logger(StripeService_1.name);
    stripe;
    webhookSecret;
    constructor(configService, prisma) {
        this.configService = configService;
        this.prisma = prisma;
        this.stripe = new stripe_1.default(this.configService.getOrThrow('STRIPE_SECRET_KEY'), { apiVersion: '2026-02-25.clover' });
        this.webhookSecret =
            this.configService.get('STRIPE_WEBHOOK_SECRET') ?? '';
    }
    async getOrCreateCustomer(userId, email, name) {
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
        this.logger.log(`Created Stripe customer ${customer.id} for user ${userId}`);
        return customer.id;
    }
    async createSubscriptionCheckout(customerId, planSlug, planName, priceCents, userId, stripePriceId, discountAmountCents) {
        const lineItem = stripePriceId
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
        let discounts;
        let couponId;
        if (discountAmountCents && discountAmountCents > 0) {
            const coupon = await this.stripe.coupons.create({
                amount_off: discountAmountCents,
                currency: 'brl',
                duration: 'once',
                name: `Upgrade para ${planName}`,
                metadata: { userId, type: 'subscription_upgrade' },
            });
            couponId = coupon.id;
            discounts = [{ coupon: coupon.id }];
        }
        const session = await this.stripe.checkout.sessions.create({
            customer: customerId,
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [lineItem],
            ...(discounts ? { discounts } : {}),
            metadata: {
                userId,
                planSlug,
                type: 'subscription',
                ...(couponId ? { upgradeCouponId: couponId } : {}),
            },
            subscription_data: {
                metadata: {
                    userId,
                    planSlug,
                },
            },
            success_url: this.configService.get('STRIPE_SUCCESS_URL') ??
                'http://localhost:3000/payment/success?session_id={CHECKOUT_SESSION_ID}',
            cancel_url: this.configService.get('STRIPE_CANCEL_URL') ??
                'http://localhost:3000/payment/cancel',
        });
        return session.url;
    }
    async createCreditPurchaseCheckout(customerId, packageId, packageName, credits, priceCents, userId, stripePriceId) {
        const lineItem = stripePriceId
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
            success_url: this.configService.get('STRIPE_SUCCESS_URL') ??
                'http://localhost:3000/payment/success?session_id={CHECKOUT_SESSION_ID}',
            cancel_url: this.configService.get('STRIPE_CANCEL_URL') ??
                'http://localhost:3000/payment/cancel',
        });
        return session.url;
    }
    constructWebhookEvent(payload, signature) {
        return this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
    }
    async upgradeSubscription(customerId, oldSubscriptionId, newStripePriceId, newPlanName, currentPlanPriceCents, userId, newPlanSlug) {
        const coupon = await this.stripe.coupons.create({
            amount_off: currentPlanPriceCents,
            currency: 'brl',
            duration: 'once',
            name: `Upgrade para ${newPlanName}`,
            metadata: { userId, type: 'subscription_upgrade' },
        });
        try {
            const oldSub = await this.stripe.subscriptions.retrieve(oldSubscriptionId);
            const defaultPaymentMethod = typeof oldSub.default_payment_method === 'string'
                ? oldSub.default_payment_method
                : oldSub.default_payment_method?.id ?? undefined;
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
            await this.stripe.subscriptions.cancel(oldSubscriptionId);
            await this.stripe.coupons.del(coupon.id).catch((err) => {
                this.logger.warn(`Failed to delete upgrade coupon ${coupon.id}: ${err instanceof Error ? err.message : err}`);
            });
            const invoiceId = typeof subscription.latest_invoice === 'string'
                ? subscription.latest_invoice
                : subscription.latest_invoice?.id ?? null;
            this.logger.log(`Upgraded subscription for user ${userId}: old=${oldSubscriptionId}, new=${subscription.id}`);
            return { stripeSubscriptionId: subscription.id, invoiceId };
        }
        catch (error) {
            await this.stripe.coupons.del(coupon.id).catch(() => { });
            throw error;
        }
    }
    async scheduleSubscriptionPlanChange(externalSubscriptionId, newStripePriceId) {
        const sub = await this.stripe.subscriptions.retrieve(externalSubscriptionId);
        const itemId = sub.items.data[0]?.id;
        if (!itemId) {
            throw new Error('Subscription has no items');
        }
        await this.stripe.subscriptions.update(externalSubscriptionId, {
            items: [{ id: itemId, price: newStripePriceId }],
            proration_behavior: 'none',
            cancel_at_period_end: false,
        });
        this.logger.log(`Scheduled plan change for subscription ${externalSubscriptionId} to price ${newStripePriceId}`);
    }
    async cancelSubscription(externalSubscriptionId) {
        await this.stripe.subscriptions.update(externalSubscriptionId, {
            cancel_at_period_end: true,
        });
        this.logger.log(`Marked Stripe subscription ${externalSubscriptionId} for cancellation at period end`);
    }
    async reactivateSubscription(externalSubscriptionId) {
        await this.stripe.subscriptions.update(externalSubscriptionId, {
            cancel_at_period_end: false,
        });
        this.logger.log(`Reactivated Stripe subscription ${externalSubscriptionId}`);
    }
};
exports.StripeService = StripeService;
exports.StripeService = StripeService = StripeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        prisma_service_1.PrismaService])
], StripeService);
//# sourceMappingURL=stripe.service.js.map