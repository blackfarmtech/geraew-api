/**
 * Moedas suportadas na cobrança e o que a Stripe retém em cada uma.
 *
 * O produto vende em BRL, USD e EUR (ver locale.util.ts). Saldos de afiliado
 * são mantidos na moeda da compra e nunca somados entre si — converter só faz
 * sentido no momento do saque, com o câmbio do dia.
 */

export const SUPPORTED_CURRENCIES = ['BRL', 'USD', 'EUR'] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const DEFAULT_CURRENCY: SupportedCurrency = 'BRL';

/**
 * Taxa da Stripe por moeda, em unidades menores (centavos/cents).
 * `percent` é fração (0.0399 = 3,99%); `fixedCents` é o valor fixo por transação.
 */
const STRIPE_FEES: Record<SupportedCurrency, { percent: number; fixedCents: number }> = {
  BRL: { percent: 0.0399, fixedCents: 39 }, // 3,99% + R$ 0,39
  USD: { percent: 0.0399, fixedCents: 30 }, // 3,99% + US$ 0,30
  EUR: { percent: 0.0399, fixedCents: 25 }, // 3,99% + € 0,25
};

export function isSupportedCurrency(value: string): value is SupportedCurrency {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(value);
}

/** Normaliza a moeda vinda da Stripe (`usd`) para o formato gravado (`USD`). */
export function normalizeCurrency(currency: string | null | undefined): SupportedCurrency {
  const upper = (currency ?? '').trim().toUpperCase();
  return isSupportedCurrency(upper) ? upper : DEFAULT_CURRENCY;
}

/** Taxa retida pela Stripe sobre um valor bruto, na moeda da transação. */
export function stripeFeeCents(amountCents: number, currency: string): number {
  const { percent, fixedCents } = STRIPE_FEES[normalizeCurrency(currency)];
  return Math.round(amountCents * percent) + fixedCents;
}
