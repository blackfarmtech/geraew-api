import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe.service';
import { AbacatepayService } from './abacatepay.service';
import { AbacatepayController } from './abacatepay.controller';
import { StripeWebhookService } from './webhooks/stripe-webhook.service';
import { MercadoPagoWebhookService } from './webhooks/mercadopago-webhook.service';
import { AbacatepayWebhookService } from './webhooks/abacatepay-webhook.service';
import { PrismaModule } from '../prisma/prisma.module';
import { WebhookLogsModule } from '../webhook-logs/webhook-logs.module';
import { EmailModule } from '../email/email.module';
import { PlansModule } from '../plans/plans.module';

@Module({
  imports: [PrismaModule, WebhookLogsModule, EmailModule, PlansModule],
  controllers: [PaymentsController, AbacatepayController],
  providers: [
    PaymentsService,
    StripeService,
    AbacatepayService,
    StripeWebhookService,
    MercadoPagoWebhookService,
    AbacatepayWebhookService,
  ],
  exports: [PaymentsService, StripeService, AbacatepayService],
})
export class PaymentsModule {}
