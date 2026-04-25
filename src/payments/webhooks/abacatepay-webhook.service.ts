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
import { AbacatepayService, AbacatepayPix } from '../abacatepay.service';

interface WebhookEnvelope {
  event?: string;
  data?: {
    id?: string;
    pixQrCode?: { id?: string };
    billing?: { id?: string };
  } & Record<string, unknown>;
}

/**
 * Processa webhooks da AbacatePay v1.
 *
 * Autenticação: a AbacatePay envia o secret no query string (?webhookSecret=).
 * Em vez de confiar no payload, sempre revalidamos o status do PIX direto
 * na API antes de creditar — protege contra forja de payload.
 */
@Injectable()
export class AbacatepayWebhookService {
  private readonly logger = new Logger(AbacatepayWebhookService.name);

  constructor(
    private readonly webhookLogsService: WebhookLogsService,
    private readonly paymentsService: PaymentsService,
    private readonly abacatepayService: AbacatepayService,
  ) {}

  async handleWebhook(
    queryWebhookSecret: string | undefined,
    payload: WebhookEnvelope,
  ): Promise<void> {
    this.assertSecret(queryWebhookSecret);

    const eventType = payload.event ?? 'unknown';
    const pixId = this.extractPixId(payload);

    if (!pixId) {
      this.logger.warn(
        `Webhook AbacatePay sem id de PIX no payload: ${JSON.stringify(payload).slice(0, 200)}`,
      );
      return;
    }

    // Idempotência: usar pixId como external_id do log (um PIX só processa 1x).
    const existingLog = await this.webhookLogsService.findByExternalId(pixId);
    if (existingLog?.processed) {
      this.logger.log(`Webhook ${pixId} já processado, ignorando`);
      return;
    }

    const log =
      existingLog ??
      (await this.webhookLogsService.create(
        'abacatepay',
        eventType,
        pixId,
        payload as unknown as Prisma.InputJsonValue,
      ));

    try {
      await this.processPixId(pixId);
      await this.webhookLogsService.markProcessed(log.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      await this.webhookLogsService.markFailed(log.id, message);
      this.logger.error(`Falha ao processar webhook ${pixId}: ${message}`);
      throw error;
    }
  }

  private assertSecret(provided: string | undefined): void {
    const expected = this.abacatepayService.getWebhookSecret();
    if (!expected) {
      this.logger.error('ABACATEPAY_WEBHOOK_SECRET não configurada');
      throw new BadRequestException('Webhook secret não configurada');
    }
    if (!provided) {
      throw new UnauthorizedException('Faltou o parâmetro webhookSecret');
    }
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('webhookSecret inválido');
    }
  }

  private extractPixId(payload: WebhookEnvelope): string | null {
    return (
      payload.data?.pixQrCode?.id ??
      payload.data?.billing?.id ??
      payload.data?.id ??
      null
    );
  }

  private async processPixId(pixId: string): Promise<void> {
    const pix: AbacatepayPix = await this.abacatepayService.checkPixStatus(pixId);

    if (pix.status !== 'PAID') {
      this.logger.log(`PIX ${pixId} ainda não está PAID (status=${pix.status}), nada a fazer`);
      return;
    }

    const meta = pix.metadata ?? {};
    const userId = typeof meta.userId === 'string' ? meta.userId : null;
    const packageId = typeof meta.packageId === 'string' ? meta.packageId : null;
    const referredByCode =
      typeof meta.referredByCode === 'string' ? meta.referredByCode : undefined;

    if (!userId || !packageId) {
      this.logger.error(
        `PIX ${pixId} sem userId/packageId no metadata — não dá para creditar`,
      );
      return;
    }

    await this.paymentsService.processCreditPurchase(
      userId,
      packageId,
      pix.amount,
      pixId,
      'BRL',
      referredByCode,
      'abacatepay',
    );

    this.logger.log(`PIX ${pixId} confirmado: créditos liberados para user ${userId}`);
  }
}
