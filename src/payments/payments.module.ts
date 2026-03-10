import { Module, forwardRef } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe.service';
import { StripeWebhookService } from './webhooks/stripe-webhook.service';
import { MercadoPagoWebhookService } from './webhooks/mercadopago-webhook.service';
import { PrismaModule } from '../prisma/prisma.module';
import { WebhookLogsModule } from '../webhook-logs/webhook-logs.module';

@Module({
  imports: [PrismaModule, WebhookLogsModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    StripeService,
    StripeWebhookService,
    MercadoPagoWebhookService,
  ],
  exports: [PaymentsService, StripeService],
})
export class PaymentsModule {}
