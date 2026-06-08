import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe.service';
import { AsaasService } from './asaas.service';
import { AsaasController } from './asaas.controller';
import { StripeWebhookService } from './webhooks/stripe-webhook.service';
import { MercadoPagoWebhookService } from './webhooks/mercadopago-webhook.service';
import { AsaasWebhookService } from './webhooks/asaas-webhook.service';
import { PrismaModule } from '../prisma/prisma.module';
import { WebhookLogsModule } from '../webhook-logs/webhook-logs.module';
import { EmailModule } from '../email/email.module';
import { PlansModule } from '../plans/plans.module';

@Module({
  imports: [PrismaModule, WebhookLogsModule, EmailModule, PlansModule],
  controllers: [PaymentsController, AsaasController],
  providers: [
    PaymentsService,
    StripeService,
    AsaasService,
    StripeWebhookService,
    MercadoPagoWebhookService,
    AsaasWebhookService,
  ],
  exports: [PaymentsService, StripeService, AsaasService],
})
export class PaymentsModule {}
