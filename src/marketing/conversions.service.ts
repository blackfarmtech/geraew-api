import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UtmfyDispatcher } from './dispatchers/utmfy.dispatcher';
import { MetaCapiDispatcher } from './dispatchers/meta-capi.dispatcher';
import type {
  InitiateCheckoutInput,
  PurchaseInput,
  UserAttribution,
} from './conversions.types';

/**
 * Ponto único para enviar eventos de conversão para UTMfy e Meta Ads (CAPI).
 *
 * Todos os métodos públicos são fire-and-forget: NUNCA lançam nem bloqueiam o
 * fluxo de pagamento. Falhas são logadas e engolidas — um erro de tracking não
 * pode derrubar o processamento de uma compra.
 *
 * A atribuição (UTMs, fbclid/fbc/fbp, ip/ua) é reidratada do registro do
 * usuário, que foi preenchido no cadastro a partir do cookie de first-touch.
 */
@Injectable()
export class ConversionsService {
  private readonly logger = new Logger(ConversionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly utmfy: UtmfyDispatcher,
    private readonly metaCapi: MetaCapiDispatcher,
  ) {}

  /** Compra confirmada — dispara Purchase para UTMfy (paid) e Meta CAPI. */
  trackPurchase(input: PurchaseInput): void {
    this.logger.log(
      `▶ Purchase order=${input.orderId} valor=R$${(input.amountCents / 100).toFixed(2)} ` +
        `${input.provider}/${input.paymentMethod} produto=${input.productId}` +
        `${input.isRenewal ? ' (renovação)' : ''} — utmfy=${this.utmfy.enabled ? 'ON' : 'off'} meta=${this.metaCapi.enabled ? 'ON' : 'off'}`,
    );
    if (!this.utmfy.enabled && !this.metaCapi.enabled) {
      this.logger.warn(
        '⚠ Purchase ignorado — nenhum destino habilitado (configure UTMFY_API_TOKEN e/ou META_PIXEL_ID + META_CAPI_ACCESS_TOKEN)',
      );
      return;
    }
    void this.dispatch('Purchase', input.orderId, () =>
      this.dispatchPurchase(input),
    );
  }

  /**
   * Início de checkout — dispara waiting_payment na UTMfy (funil de abandono).
   * O InitiateCheckout do Meta é disparado pelo Pixel no navegador (tem _fbp/_fbc
   * nativos); não enviamos via CAPI aqui para não duplicar sem chave de dedup.
   */
  trackInitiateCheckout(input: InitiateCheckoutInput): void {
    this.logger.log(
      `▶ InitiateCheckout order=${input.orderId} valor=R$${(input.amountCents / 100).toFixed(2)} ` +
        `${input.provider}/${input.paymentMethod} produto=${input.productId} — utmfy=${this.utmfy.enabled ? 'ON' : 'off'}`,
    );
    if (!this.utmfy.enabled) {
      this.logger.warn('⚠ InitiateCheckout ignorado — UTMFY_API_TOKEN não configurado');
      return;
    }
    void this.dispatch('InitiateCheckout', input.orderId, () =>
      this.dispatchInitiateCheckout(input),
    );
  }

  private async dispatch(
    event: string,
    orderId: string,
    fn: () => Promise<void>,
  ): Promise<void> {
    try {
      await fn();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`${event} tracking falhou (order=${orderId}): ${msg}`);
    }
  }

  private async dispatchPurchase(input: PurchaseInput): Promise<void> {
    const user = await this.loadAttribution(input.userId);
    if (!user) {
      this.logger.warn(`Purchase sem usuário ${input.userId} — pulando tracking`);
      return;
    }
    this.logger.log(
      `   match order=${input.orderId}: email=${user.email ? 'sim' : 'NÃO'} ` +
        `fbc=${user.fbc || user.fbclid ? 'sim' : 'NÃO'} fbp=${user.fbp ? 'sim' : 'não'} ` +
        `ip=${user.signupIp ? 'sim' : 'não'} utm_source=${user.utmSource ?? '—'} utm_content=${user.utmContent ?? '—'}`,
    );
    const results = await Promise.allSettled([
      this.utmfy.enabled ? this.utmfy.sendPaid(input, user) : Promise.resolve(),
      this.metaCapi.enabled
        ? this.metaCapi.sendPurchase(input, user)
        : Promise.resolve(),
    ]);
    this.logRejections('Purchase', input.orderId, results);
  }

  private async dispatchInitiateCheckout(
    input: InitiateCheckoutInput,
  ): Promise<void> {
    const user = await this.loadAttribution(input.userId);
    if (!user) return;
    await this.utmfy.sendWaitingPayment(input, user);
  }

  private logRejections(
    event: string,
    orderId: string,
    results: PromiseSettledResult<unknown>[],
  ): void {
    for (const r of results) {
      if (r.status === 'rejected') {
        const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
        this.logger.error(`${event} dispatcher falhou (order=${orderId}): ${msg}`);
      }
    }
  }

  private async loadAttribution(userId: string): Promise<UserAttribution | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        name: true,
        phone: true,
        taxId: true,
        createdAt: true,
        utmSource: true,
        utmMedium: true,
        utmCampaign: true,
        utmContent: true,
        utmTerm: true,
        fbclid: true,
        fbc: true,
        fbp: true,
        signupIp: true,
        signupUserAgent: true,
      },
    });
  }
}
