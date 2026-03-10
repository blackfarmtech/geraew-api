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
var StripeWebhookService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StripeWebhookService = void 0;
const common_1 = require("@nestjs/common");
const webhook_logs_service_1 = require("../../webhook-logs/webhook-logs.service");
const payments_service_1 = require("../payments.service");
const stripe_service_1 = require("../stripe.service");
let StripeWebhookService = StripeWebhookService_1 = class StripeWebhookService {
    webhookLogsService;
    paymentsService;
    stripeService;
    logger = new common_1.Logger(StripeWebhookService_1.name);
    constructor(webhookLogsService, paymentsService, stripeService) {
        this.webhookLogsService = webhookLogsService;
        this.paymentsService = paymentsService;
        this.stripeService = stripeService;
    }
    async handleWebhook(payload, signature) {
        let event;
        try {
            event = this.stripeService.constructWebhookEvent(payload, signature);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            this.logger.error(`Webhook signature verification failed: ${message}`);
            throw new common_1.BadRequestException(`Webhook signature verification failed: ${message}`);
        }
        const eventType = event.type;
        const externalId = event.id;
        const existingLog = await this.webhookLogsService.findByExternalId(externalId);
        if (existingLog?.processed) {
            this.logger.log(`Event ${externalId} already processed, skipping`);
            return;
        }
        const log = await this.webhookLogsService.create('stripe', eventType, externalId, JSON.parse(JSON.stringify(event)));
        try {
            await this.routeEvent(eventType, event);
            await this.webhookLogsService.markProcessed(log.id);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            await this.webhookLogsService.markFailed(log.id, message);
            this.logger.error(`Failed to process Stripe event ${eventType}: ${message}`);
        }
    }
    async routeEvent(eventType, event) {
        switch (eventType) {
            case 'checkout.session.completed':
                await this.handleCheckoutSessionCompleted(event);
                break;
            case 'invoice.payment_succeeded':
                await this.handleInvoicePaymentSucceeded(event);
                break;
            case 'invoice.payment_failed':
                await this.handleInvoicePaymentFailed(event);
                break;
            case 'customer.subscription.deleted':
                await this.handleSubscriptionDeleted(event);
                break;
            default:
                this.logger.log(`Unhandled Stripe event type: ${eventType}`);
        }
    }
    async handleCheckoutSessionCompleted(event) {
        const session = event.data.object;
        const metadata = session.metadata ?? {};
        const type = metadata.type;
        this.logger.log(`Checkout completed: ${session.id}, type: ${type}`);
        if (type === 'subscription') {
            const userId = metadata.userId;
            const planSlug = metadata.planSlug;
            const stripeSubscriptionId = typeof session.subscription === 'string'
                ? session.subscription
                : session.subscription?.id;
            if (!userId || !planSlug || !stripeSubscriptionId) {
                this.logger.error(`Missing metadata in checkout session: userId=${userId}, planSlug=${planSlug}, subscriptionId=${stripeSubscriptionId}`);
                return;
            }
            await this.paymentsService.processSubscriptionPayment(userId, planSlug, stripeSubscriptionId, session.amount_total ?? 0, session.payment_intent ?? session.id);
        }
        else if (type === 'credit_purchase') {
            const userId = metadata.userId;
            const packageId = metadata.packageId;
            if (!userId || !packageId) {
                this.logger.error(`Missing metadata in checkout session: userId=${userId}, packageId=${packageId}`);
                return;
            }
            await this.paymentsService.processCreditPurchase(userId, packageId, session.amount_total ?? 0, session.payment_intent ?? session.id);
        }
        else {
            this.logger.warn(`Unknown checkout type: ${type}`);
        }
    }
    async handleInvoicePaymentSucceeded(event) {
        const invoice = event.data.object;
        if (invoice.billing_reason === 'subscription_create') {
            this.logger.log(`Skipping invoice for subscription_create: ${invoice.id}`);
            return;
        }
        const stripeSubscriptionId = this.extractSubscriptionId(invoice);
        if (!stripeSubscriptionId) {
            this.logger.warn(`No subscription ID in invoice ${invoice.id}`);
            return;
        }
        const periodStart = invoice.lines?.data?.[0]?.period?.start
            ? new Date(invoice.lines.data[0].period.start * 1000)
            : new Date();
        const periodEnd = invoice.lines?.data?.[0]?.period?.end
            ? new Date(invoice.lines.data[0].period.end * 1000)
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await this.paymentsService.handleSubscriptionRenewal(stripeSubscriptionId, periodStart, periodEnd, invoice.amount_paid ?? 0, invoice.id);
    }
    async handleInvoicePaymentFailed(event) {
        const invoice = event.data.object;
        const stripeSubscriptionId = this.extractSubscriptionId(invoice);
        if (!stripeSubscriptionId) {
            this.logger.warn(`No subscription ID in invoice ${invoice.id}`);
            return;
        }
        await this.paymentsService.handlePaymentFailed(stripeSubscriptionId, invoice.amount_due ?? 0, invoice.id);
    }
    async handleSubscriptionDeleted(event) {
        const subscription = event.data.object;
        await this.paymentsService.handleSubscriptionDeleted(subscription.id);
    }
    extractSubscriptionId(invoice) {
        const sub = invoice.parent?.subscription_details?.subscription;
        if (!sub)
            return null;
        return typeof sub === 'string' ? sub : sub.id;
    }
};
exports.StripeWebhookService = StripeWebhookService;
exports.StripeWebhookService = StripeWebhookService = StripeWebhookService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [webhook_logs_service_1.WebhookLogsService,
        payments_service_1.PaymentsService,
        stripe_service_1.StripeService])
], StripeWebhookService);
//# sourceMappingURL=stripe-webhook.service.js.map