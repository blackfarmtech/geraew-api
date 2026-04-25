import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type AbacatepayPixStatus =
  | 'PENDING'
  | 'PAID'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'REFUNDED';

export interface AbacatepayPix {
  id: string;
  amount: number;
  status: AbacatepayPixStatus;
  devMode: boolean;
  brCode: string;
  brCodeBase64: string;
  platformFee: number;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

interface CreatePixInput {
  amountCents: number;
  description?: string;
  expiresInSeconds?: number;
  customer?: {
    name?: string;
    email?: string;
    taxId?: string;
    cellphone?: string;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Cliente HTTP para a API v1 da AbacatePay (chaves abc_dev_* e abc_live_*).
 * Suporta apenas PIX QR Code (Checkout Transparente). Subscriptions seguem no Stripe.
 */
@Injectable()
export class AbacatepayService {
  private readonly logger = new Logger(AbacatepayService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly webhookSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.getOrThrow<string>('ABACATEPAY_API_KEY').trim();
    const rawBase = this.configService
      .get<string>('ABACATEPAY_BASE_URL', 'https://api.abacatepay.com')
      .trim()
      .replace(/\/+$/, '')
      .replace(/\/v\d+$/, '');
    this.baseUrl = `${rawBase}/v1`;
    this.webhookSecret = this.configService
      .get<string>('ABACATEPAY_WEBHOOK_SECRET', '')
      .trim();
  }

  getWebhookSecret(): string {
    return this.webhookSecret;
  }

  async createPixCharge(input: CreatePixInput): Promise<AbacatepayPix> {
    const body: Record<string, unknown> = {
      amount: input.amountCents,
    };
    if (input.description) body.description = input.description.slice(0, 37);
    if (input.expiresInSeconds) body.expiresIn = input.expiresInSeconds;
    if (input.customer) body.customer = input.customer;
    if (input.metadata) body.metadata = input.metadata;

    return this.request<AbacatepayPix>('POST', '/pixQrCode/create', body);
  }

  async checkPixStatus(id: string): Promise<AbacatepayPix> {
    return this.request<AbacatepayPix>(
      'GET',
      `/pixQrCode/check?id=${encodeURIComponent(id)}`,
    );
  }

  async simulatePixPayment(id: string): Promise<AbacatepayPix> {
    return this.request<AbacatepayPix>(
      'POST',
      `/pixQrCode/simulate-payment?id=${encodeURIComponent(id)}`,
      { metadata: { simulated: true } },
    );
  }

  private async request<T>(
    method: 'GET' | 'POST',
    pathname: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${pathname}`;
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let parsed: { data?: T; error?: string | null; success?: boolean };
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = {};
    }

    if (!res.ok || parsed.success === false || parsed.error) {
      const message = parsed.error ?? `HTTP ${res.status}`;
      this.logger.error(`AbacatePay ${method} ${pathname} failed: ${message}`);
      throw new InternalServerErrorException(`AbacatePay: ${message}`);
    }

    if (!parsed.data) {
      throw new InternalServerErrorException(
        `AbacatePay ${pathname}: resposta sem campo "data"`,
      );
    }

    return parsed.data;
  }
}
