import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import type {
  InitiateCheckoutInput,
  PurchaseInput,
  UserAttribution,
} from '../conversions.types';

const GRAPH_VERSION = 'v21.0';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Normaliza e faz hash de um campo de PII conforme especificação do Meta. */
function hashField(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  return sha256(normalized);
}

/** Telefone: só dígitos (com DDI), depois hash. */
function hashPhone(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const digits = value.replace(/\D/g, '');
  if (!digits) return undefined;
  return sha256(digits);
}

/**
 * Reconstrói o cookie `_fbc` a partir do `fbclid` quando o valor real não foi
 * capturado no navegador. Formato: fb.1.<timestamp_ms>.<fbclid>.
 * Usa o createdAt do usuário como aproximação do horário do clique.
 */
function buildFbc(user: UserAttribution): string | undefined {
  if (user.fbc) return user.fbc;
  if (!user.fbclid) return undefined;
  const ts = (user.createdAt ?? new Date()).getTime();
  return `fb.1.${ts}.${user.fbclid}`;
}

/**
 * Envia eventos para a Conversions API (CAPI) do Meta.
 *
 * O `event_id` é o `orderId` — o mesmo id que o Pixel do navegador envia — para
 * o Meta deduplicar o evento browser + server e não contar em dobro.
 *
 * Docs: developers.facebook.com/docs/marketing-api/conversions-api
 */
@Injectable()
export class MetaCapiDispatcher {
  private readonly logger = new Logger(MetaCapiDispatcher.name);
  private readonly pixelId?: string;
  private readonly accessToken?: string;
  private readonly testEventCode?: string;
  private readonly siteUrl: string;

  constructor(private readonly config: ConfigService) {
    this.pixelId = this.config.get<string>('META_PIXEL_ID');
    this.accessToken = this.config.get<string>('META_CAPI_ACCESS_TOKEN');
    this.testEventCode = this.config.get<string>('META_TEST_EVENT_CODE');
    this.siteUrl =
      this.config.get<string>('SITE_URL') ?? 'https://geraew.ai';
  }

  get enabled(): boolean {
    return !!this.pixelId && !!this.accessToken;
  }

  async sendPurchase(input: PurchaseInput, user: UserAttribution): Promise<void> {
    await this.send('Purchase', input.orderId, input, user);
  }

  async sendInitiateCheckout(
    input: InitiateCheckoutInput,
    user: UserAttribution,
  ): Promise<void> {
    await this.send('InitiateCheckout', input.orderId, input, user);
  }

  private async send(
    eventName: 'Purchase' | 'InitiateCheckout',
    eventId: string,
    input: PurchaseInput | InitiateCheckoutInput,
    user: UserAttribution,
  ): Promise<void> {
    if (!this.pixelId || !this.accessToken) return;

    const em = hashField(user.email);
    const ph = hashPhone(user.phone);
    const externalId = sha256(input.userId);
    const fbc = buildFbc(user);

    const userData: Record<string, unknown> = {
      external_id: [externalId],
    };
    if (em) userData.em = [em];
    if (ph) userData.ph = [ph];
    if (fbc) userData.fbc = fbc;
    if (user.fbp) userData.fbp = user.fbp;
    if (user.signupIp) userData.client_ip_address = user.signupIp;
    if (user.signupUserAgent) userData.client_user_agent = user.signupUserAgent;

    const body = {
      data: [
        {
          event_name: eventName,
          event_time: Math.floor(Date.now() / 1000),
          event_id: eventId,
          action_source: 'website',
          event_source_url: this.siteUrl,
          user_data: userData,
          custom_data: {
            currency: input.currency.toUpperCase(),
            value: Number((input.amountCents / 100).toFixed(2)),
            content_ids: [input.productId],
            content_name: input.productName,
            content_type: 'product',
          },
        },
      ],
      ...(this.testEventCode ? { test_event_code: this.testEventCode } : {}),
    };

    const url = `https://graph.facebook.com/${GRAPH_VERSION}/${this.pixelId}/events?access_token=${encodeURIComponent(this.accessToken)}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Meta CAPI ${eventName} ${res.status}: ${text.slice(0, 300)}`);
    }

    const json = (await res.json().catch(() => ({}))) as {
      events_received?: number;
      fbtrace_id?: string;
    };
    this.logger.log(
      `✔ Meta CAPI ${eventName} OK — event_id=${eventId} ` +
        `events_received=${json.events_received ?? '?'} ` +
        `${this.testEventCode ? `[TESTE ${this.testEventCode}] ` : ''}` +
        `fbtrace=${json.fbtrace_id ?? '—'}`,
    );
  }
}
