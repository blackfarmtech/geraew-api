import { RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import { StripeWebhookService } from './webhooks/stripe-webhook.service';
import { MercadoPagoWebhookService } from './webhooks/mercadopago-webhook.service';
export declare class PaymentsController {
    private readonly stripeWebhookService;
    private readonly mercadoPagoWebhookService;
    private readonly logger;
    constructor(stripeWebhookService: StripeWebhookService, mercadoPagoWebhookService: MercadoPagoWebhookService);
    stripeWebhook(req: RawBodyRequest<Request>, signature: string): Promise<{
        received: true;
    }>;
    mercadoPagoWebhook(req: Request, signature: string, payload: any): Promise<{
        received: true;
    }>;
}
