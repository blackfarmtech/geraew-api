import { RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import { StripeWebhookService } from './webhooks/stripe-webhook.service';
import { MercadoPagoWebhookService } from './webhooks/mercadopago-webhook.service';
export declare class PaymentsController {
    private readonly stripeWebhookService;
    private readonly mercadoPagoWebhookService;
    constructor(stripeWebhookService: StripeWebhookService, mercadoPagoWebhookService: MercadoPagoWebhookService);
    stripeWebhook(req: RawBodyRequest<Request>, signature: string): Promise<{
        received: true;
    }>;
    mercadoPagoWebhook(payload: any): Promise<{
        received: true;
    }>;
}
