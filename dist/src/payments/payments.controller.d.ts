import { RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import { StripeWebhookService } from './webhooks/stripe-webhook.service';
import { MercadoPagoWebhookService } from './webhooks/mercadopago-webhook.service';
import { PaymentsService } from './payments.service';
export declare class PaymentsController {
    private readonly stripeWebhookService;
    private readonly mercadoPagoWebhookService;
    private readonly paymentsService;
    private readonly logger;
    constructor(stripeWebhookService: StripeWebhookService, mercadoPagoWebhookService: MercadoPagoWebhookService, paymentsService: PaymentsService);
    stripeWebhook(req: RawBodyRequest<Request>, signature: string): Promise<{
        received: true;
    }>;
    mercadoPagoWebhook(payload: any): Promise<{
        received: true;
    }>;
    simulateRenewal(body: {
        stripeSubscriptionId: string;
    }): Promise<{
        success: boolean;
        message: string;
    }>;
}
