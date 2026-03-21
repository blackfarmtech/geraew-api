import {
  Controller,
  Post,
  Req,
  Headers,
  Body,
  HttpCode,
  HttpStatus,
  RawBodyRequest,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '../common/decorators';
import { StripeWebhookService } from './webhooks/stripe-webhook.service';
import { MercadoPagoWebhookService } from './webhooks/mercadopago-webhook.service';
import { PaymentsService } from './payments.service';

@ApiTags('webhooks')
@Controller('api/v1/webhooks')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly stripeWebhookService: StripeWebhookService,
    private readonly mercadoPagoWebhookService: MercadoPagoWebhookService,
    private readonly paymentsService: PaymentsService,
  ) {}

  @Public()
  @Post('stripe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stripe webhook endpoint' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  @ApiResponse({ status: 400, description: 'Invalid payload' })
  async stripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ): Promise<{ received: true }> {
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body));
    await this.stripeWebhookService.handleWebhook(rawBody, signature);
    return { received: true };
  }

  @Public()
  @Post('mercadopago')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'MercadoPago webhook endpoint' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  @ApiResponse({ status: 400, description: 'Invalid payload' })
  async mercadoPagoWebhook(
    @Body() payload: any,
  ): Promise<{ received: true }> {
    await this.mercadoPagoWebhookService.handleWebhook(payload);
    return { received: true };
  }

  /**
   * ⚠️ ENDPOINT TEMPORÁRIO DE TESTE — remover antes de ir para produção.
   * Simula uma renovação de assinatura (invoice.payment_succeeded).
   */
  @Public()
  @Post('test/simulate-renewal')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[DEV] Simula renovação de assinatura' })
  async simulateRenewal(
    @Body() body: { stripeSubscriptionId: string },
  ): Promise<{ success: boolean; message: string }> {
    if (process.env.NODE_ENV === 'production') {
      return { success: false, message: 'Not available in production' };
    }

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    this.logger.warn(
      `[TEST] Simulating renewal for subscription: ${body.stripeSubscriptionId}`,
    );

    await this.paymentsService.handleSubscriptionRenewal(
      body.stripeSubscriptionId,
      now,
      periodEnd,
      0, // amountCents — irrelevante para o teste
      `test_invoice_${Date.now()}`,
    );

    return { success: true, message: 'Renewal simulated successfully' };
  }
}
