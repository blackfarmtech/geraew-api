export type PaymentProvider = 'stripe' | 'asaas' | 'mercadopago';
export type PaymentMethod = 'credit_card' | 'pix' | 'boleto';

/**
 * Compra confirmada (fonte da verdade: webhook do gateway).
 * `orderId` DEVE ser um id nativo do gateway que também esteja disponível no
 * navegador (ex.: session_id do Stripe, paymentId do PIX) — é usado como
 * `event_id` no Meta CAPI e `orderId` na UTMfy para deduplicar com o Pixel.
 */
export interface PurchaseInput {
  userId: string;
  orderId: string;
  amountCents: number;
  currency: string;
  provider: PaymentProvider;
  paymentMethod: PaymentMethod;
  productId: string;
  productName: string;
  isRenewal?: boolean;
}

/** Início de checkout (cobrança criada, ainda não paga). */
export interface InitiateCheckoutInput {
  userId: string;
  orderId: string;
  amountCents: number;
  currency: string;
  provider: PaymentProvider;
  paymentMethod: PaymentMethod;
  productId: string;
  productName: string;
}

/** Atribuição reidratada do registro do usuário. */
export interface UserAttribution {
  email: string | null;
  name: string | null;
  phone: string | null;
  taxId: string | null;
  createdAt: Date;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  fbclid: string | null;
  fbc: string | null;
  fbp: string | null;
  signupIp: string | null;
  signupUserAgent: string | null;
}
