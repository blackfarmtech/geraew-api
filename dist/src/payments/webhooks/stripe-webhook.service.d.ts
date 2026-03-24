import { WebhookLogsService } from '../../webhook-logs/webhook-logs.service';
import { PaymentsService } from '../payments.service';
import { StripeService } from '../stripe.service';
export declare class StripeWebhookService {
    private readonly webhookLogsService;
    private readonly paymentsService;
    private readonly stripeService;
    private readonly logger;
    constructor(webhookLogsService: WebhookLogsService, paymentsService: PaymentsService, stripeService: StripeService);
    handleWebhook(payload: Buffer, signature: string): Promise<void>;
    private routeEvent;
    private handleCheckoutSessionCompleted;
    private handleInvoicePaymentSucceeded;
    private handleInvoicePaymentFailed;
    private handleSubscriptionDeleted;
    private handleChargeRefunded;
    private extractSubscriptionId;
}
