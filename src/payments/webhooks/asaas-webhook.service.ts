import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { timingSafeEqual } from 'node:crypto';
import { WebhookLogsService } from '../../webhook-logs/webhook-logs.service';
import { PaymentsService } from '../payments.service';
import { AsaasService } from '../asaas.service';

interface AsaasWebhookEnvelope {
  event?: string;
  payment?: {
    id?: string;
    status?: string;
    value?: number;
    externalReference?: string | null;
  } & Record<string, unknown>;
}

interface ExternalRef {
  userId?: string;
  packageId?: string;
  referredByCode?: string;
}

/**
 * Processa webhooks do ASAAS v3.
 *
 * Autenticação: ASAAS envia o secret no header asaas-access-token.
 * Em vez de confiar no payload, sempre revalidamos o status do payment
 * direto na API antes de creditar — protege contra forja de payload.
 *
 * Idempotência: usar paymentId como external_id do log. Webhook_logs
 * dedupa eventos repetidos (ASAAS pode enviar PAYMENT_RECEIVED +
 * PAYMENT_CONFIRMED pro mesmo payment — só processamos uma vez).
 */
@Injectable()
export class AsaasWebhookService {
  private readonly logger = new Logger(AsaasWebhookService.name);

  constructor(
    private readonly webhookLogsService: WebhookLogsService,
    private readonly paymentsService: PaymentsService,
    private readonly asaasService: AsaasService,
  ) {}

  async handleWebhook(
    accessToken: string | undefined,
    payload: AsaasWebhookEnvelope,
  ): Promise<void> {
    this.assertSecret(accessToken);

    const eventType = payload.event ?? 'unknown';
    const paymentId = payload.payment?.id;

    if (!paymentId) {
      this.logger.warn(
        `Webhook ASAAS sem payment.id: ${JSON.stringify(payload).slice(0, 200)}`,
      );
      return;
    }

    const existingLog = await this.webhookLogsService.findByExternalId(paymentId);
    if (existingLog?.processed) {
      this.logger.log(`Webhook ${paymentId} já processado, ignorando`);
      return;
    }

    const log =
      existingLog ??
      (await this.webhookLogsService.create(
        'asaas',
        eventType,
        paymentId,
        payload as unknown as Prisma.InputJsonValue,
      ));

    try {
      await this.processPaymentId(paymentId);
      await this.webhookLogsService.markProcessed(log.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      await this.webhookLogsService.markFailed(log.id, message);
      this.logger.error(`Falha ao processar webhook ${paymentId}: ${message}`);
      throw error;
    }
  }

  private assertSecret(provided: string | undefined): void {
    const expected = this.asaasService.getWebhookSecret();
    if (!expected) {
      this.logger.error('ASAAS_WEBHOOK_SECRET não configurada');
      throw new BadRequestException('Webhook secret não configurada');
    }
    if (!provided) {
      throw new UnauthorizedException('Faltou header asaas-access-token');
    }
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('asaas-access-token inválido');
    }
  }

  private async processPaymentId(paymentId: string): Promise<void> {
    const payment = await this.asaasService.checkPaymentStatus(paymentId);

    if (payment.status !== 'PAID') {
      this.logger.log(
        `Payment ${paymentId} não está PAID (status=${payment.status}), nada a fazer`,
      );
      return;
    }

    const ref = this.parseExternalRef(payment.externalReference);
    if (!ref.userId || !ref.packageId) {
      this.logger.error(
        `Payment ${paymentId} sem userId/packageId no externalReference — não dá pra creditar`,
      );
      return;
    }

    await this.paymentsService.processCreditPurchase(
      ref.userId,
      ref.packageId,
      payment.amountCents,
      paymentId,
      'BRL',
      ref.referredByCode,
      'asaas',
    );

    this.logger.log(`Payment ${paymentId} confirmado: créditos liberados para user ${ref.userId}`);
  }

  private parseExternalRef(raw: string | null | undefined): ExternalRef {
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw) as ExternalRef;
      return {
        userId: typeof parsed.userId === 'string' ? parsed.userId : undefined,
        packageId: typeof parsed.packageId === 'string' ? parsed.packageId : undefined,
        referredByCode:
          typeof parsed.referredByCode === 'string' ? parsed.referredByCode : undefined,
      };
    } catch {
      return {};
    }
  }
}
