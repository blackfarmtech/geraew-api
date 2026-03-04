import { ConfigService } from '@nestjs/config';
import { WebhookLogsService } from '../../webhook-logs/webhook-logs.service';
import { PaymentsService } from '../payments.service';
export declare class StripeWebhookService {
    private readonly configService;
    private readonly webhookLogsService;
    private readonly paymentsService;
    private readonly logger;
    constructor(configService: ConfigService, webhookLogsService: WebhookLogsService, paymentsService: PaymentsService);
    handleWebhook(payload: Buffer, signature: string): Promise<void>;
    private routeEvent;
    private handleCheckoutSessionCompleted;
    private handleInvoicePaymentSucceeded;
    private handleInvoicePaymentFailed;
    private handleSubscriptionDeleted;
}
