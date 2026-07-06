import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  InitiateCheckoutInput,
  PurchaseInput,
  UserAttribution,
} from '../conversions.types';

const UTMFY_ORDERS_URL = 'https://api.utmify.com.br/api-credentials/orders';

/**
 * Formata uma data em UTC no formato exigido pela UTMfy: "YYYY-MM-DD HH:MM:SS".
 */
function toUtmfyDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ` +
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`
  );
}

/**
 * Envia pedidos (orders) para a UTMfy via API de credenciais.
 *
 * A UTMfy deduplica por `orderId` e monta o funil quando o mesmo pedido é
 * enviado como `waiting_payment` (início) e depois `paid` (aprovado). Por isso
 * o `orderId` precisa ser estável entre os dois momentos.
 *
 * Docs: UTMfy → Integrações → Credenciais de API (token em `x-api-token`).
 */
@Injectable()
export class UtmfyDispatcher {
  private readonly logger = new Logger(UtmfyDispatcher.name);
  private readonly apiToken?: string;
  private readonly isTest: boolean;

  constructor(private readonly config: ConfigService) {
    this.apiToken = this.config.get<string>('UTMFY_API_TOKEN');
    this.isTest = this.config.get<string>('UTMFY_TEST_MODE') === 'true';
  }

  get enabled(): boolean {
    return !!this.apiToken;
  }

  async sendPaid(input: PurchaseInput, user: UserAttribution): Promise<void> {
    const now = new Date();
    await this.post({
      orderId: input.orderId,
      status: 'paid',
      createdAt: toUtmfyDate(user.createdAt ?? now),
      approvedDate: toUtmfyDate(now),
      input,
      user,
    });
  }

  async sendWaitingPayment(
    input: InitiateCheckoutInput,
    user: UserAttribution,
  ): Promise<void> {
    const now = new Date();
    await this.post({
      orderId: input.orderId,
      status: 'waiting_payment',
      createdAt: toUtmfyDate(now),
      approvedDate: null,
      input,
      user,
    });
  }

  private async post(args: {
    orderId: string;
    status: 'paid' | 'waiting_payment';
    createdAt: string;
    approvedDate: string | null;
    input: PurchaseInput | InitiateCheckoutInput;
    user: UserAttribution;
  }): Promise<void> {
    if (!this.apiToken) return;

    const { input, user } = args;
    const priceInCents = input.amountCents;

    const body = {
      orderId: args.orderId,
      platform: 'GeraEW',
      paymentMethod: input.paymentMethod,
      status: args.status,
      createdAt: args.createdAt,
      approvedDate: args.approvedDate,
      refundedAt: null,
      customer: {
        name: user.name ?? 'Cliente',
        email: user.email ?? `${input.userId}@geraew.ai`,
        phone: user.phone ?? null,
        document: user.taxId ?? null,
        country: 'BR',
        ip: user.signupIp ?? null,
      },
      products: [
        {
          id: input.productId,
          name: input.productName,
          planId: null,
          planName: null,
          quantity: 1,
          priceInCents,
        },
      ],
      trackingParameters: {
        src: null,
        sck: null,
        utm_source: user.utmSource ?? null,
        utm_campaign: user.utmCampaign ?? null,
        utm_medium: user.utmMedium ?? null,
        utm_content: user.utmContent ?? null,
        utm_term: user.utmTerm ?? null,
      },
      commission: {
        totalPriceInCents: priceInCents,
        gatewayFeeInCents: 0,
        userCommissionInCents: priceInCents,
        currency: input.currency.toUpperCase(),
      },
      isTest: this.isTest,
    };

    const res = await fetch(UTMFY_ORDERS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-token': this.apiToken,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`UTMfy ${args.status} ${res.status}: ${text.slice(0, 300)}`);
    }

    this.logger.log(
      `✔ UTMfy order ${args.orderId} OK — status=${args.status} produto=${input.productName} ` +
        `utm_source=${user.utmSource ?? '—'}${this.isTest ? ' [TESTE]' : ''}`,
    );
  }
}
