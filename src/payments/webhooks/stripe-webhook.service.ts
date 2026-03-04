import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebhookLogsService } from '../../webhook-logs/webhook-logs.service';
import { PaymentsService } from '../payments.service';

@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger(StripeWebhookService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly webhookLogsService: WebhookLogsService,
    private readonly paymentsService: PaymentsService,
  ) {}

  async handleWebhook(payload: Buffer, signature: string): Promise<void> {
    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );

    // TODO: Verify Stripe signature using stripe SDK
    // const stripe = new Stripe(this.configService.get('STRIPE_SECRET_KEY'));
    // const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    // For MVP: parse raw JSON (signature verification will be added with Stripe SDK)
    if (!webhookSecret) {
      this.logger.warn('STRIPE_WEBHOOK_SECRET not configured');
    }

    let event: any;
    try {
      event = JSON.parse(payload.toString());
    } catch {
      throw new BadRequestException('Invalid JSON payload');
    }

    const eventType = event.type ?? 'unknown';
    const externalId = event.id ?? null;

    // Log the webhook event
    const log = await this.webhookLogsService.create(
      'stripe',
      eventType,
      externalId,
      event,
    );

    try {
      await this.routeEvent(eventType, event);
      await this.webhookLogsService.markProcessed(log.id);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error';
      await this.webhookLogsService.markFailed(log.id, message);
      this.logger.error(`Failed to process Stripe event ${eventType}`, message);
    }
  }

  private async routeEvent(eventType: string, event: any): Promise<void> {
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

  private async handleCheckoutSessionCompleted(event: any): Promise<void> {
    // TODO: Implement checkout.session.completed handling
    // 1. Extract session data from event.data.object
    // 2. Find or create payment record
    // 3. If subscription: call paymentsService.processSubscriptionPayment
    // 4. If credit purchase: call paymentsService.processCreditPurchase
    this.logger.log(
      `Stripe checkout.session.completed: ${event.data?.object?.id ?? 'unknown'}`,
    );
  }

  private async handleInvoicePaymentSucceeded(event: any): Promise<void> {
    // TODO: Implement invoice.payment_succeeded handling
    // 1. Extract invoice data from event.data.object
    // 2. Update payment status to completed
    // 3. Renew subscription period and reset credits
    this.logger.log(
      `Stripe invoice.payment_succeeded: ${event.data?.object?.id ?? 'unknown'}`,
    );
  }

  private async handleInvoicePaymentFailed(event: any): Promise<void> {
    // TODO: Implement invoice.payment_failed handling
    // 1. Extract invoice data from event.data.object
    // 2. Update payment status to failed
    // 3. Mark subscription as past_due, increment retry count
    this.logger.log(
      `Stripe invoice.payment_failed: ${event.data?.object?.id ?? 'unknown'}`,
    );
  }

  private async handleSubscriptionDeleted(event: any): Promise<void> {
    // TODO: Implement customer.subscription.deleted handling
    // 1. Extract subscription data from event.data.object
    // 2. Mark subscription as canceled
    // 3. Downgrade user to Free plan
    this.logger.log(
      `Stripe customer.subscription.deleted: ${event.data?.object?.id ?? 'unknown'}`,
    );
  }
}
