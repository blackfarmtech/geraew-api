import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import Stripe from 'stripe';
export declare class StripeService {
    private readonly configService;
    private readonly prisma;
    private readonly logger;
    private readonly stripe;
    private readonly webhookSecret;
    constructor(configService: ConfigService, prisma: PrismaService);
    getOrCreateCustomer(userId: string, email: string, name: string): Promise<string>;
    createSubscriptionCheckout(customerId: string, planSlug: string, planName: string, priceCents: number, userId: string, stripePriceId?: string | null, discountAmountCents?: number): Promise<string>;
    createCreditPurchaseCheckout(customerId: string, packageId: string, packageName: string, credits: number, priceCents: number, userId: string, stripePriceId?: string | null): Promise<string>;
    constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event;
    upgradeSubscription(customerId: string, oldSubscriptionId: string, newStripePriceId: string, newPlanName: string, currentPlanPriceCents: number, userId: string, newPlanSlug: string): Promise<{
        stripeSubscriptionId: string;
        invoiceId: string | null;
    }>;
    scheduleSubscriptionPlanChange(externalSubscriptionId: string, newStripePriceId: string): Promise<void>;
    cancelSubscription(externalSubscriptionId: string): Promise<void>;
    reactivateSubscription(externalSubscriptionId: string): Promise<void>;
}
