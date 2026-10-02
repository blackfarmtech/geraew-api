import { BillingInterval } from '@prisma/client';

/**
 * Regras do plano anual — fonte única da verdade.
 *
 * - Cobrança anual com ANNUAL_DISCOUNT_PERCENT de desconto sobre 12× o mensal.
 * - O período da assinatura (current_period_*) cobre 1 ano, mas os créditos do
 *   plano continuam renovando todo mês (credit_balances.period_*), via cron
 *   AnnualCreditRefreshService.
 */
export const ANNUAL_DISCOUNT_PERCENT = 20;

export const BILLING_INTERVALS = ['MONTHLY', 'YEARLY'] as const;

/** Preço anual (centavos) a partir do mensal, já com o desconto do anual. */
export function annualPriceFromMonthly(monthlyCents: number): number {
  return Math.round(monthlyCents * 12 * (1 - ANNUAL_DISCOUNT_PERCENT / 100));
}

/** Desconto real (%) de um preço anual em relação a 12× o mensal. */
export function annualDiscountPercent(
  annualCents: number,
  monthlyCents: number,
): number {
  if (monthlyCents <= 0) return 0;
  return Math.round((1 - annualCents / (monthlyCents * 12)) * 100);
}

/**
 * Soma meses mantendo o dia, mas sem "transbordar" para o mês seguinte
 * (31/01 + 1 mês = 28 ou 29/02, não 02 ou 03/03).
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0,
  ).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
}

export function addBillingInterval(
  date: Date,
  interval: BillingInterval,
): Date {
  return addMonths(date, interval === 'YEARLY' ? 12 : 1);
}

/**
 * Fim do ciclo de créditos que começa em `start`: 1 mês, limitado ao fim do
 * período pago da assinatura (no mensal os dois coincidem).
 */
export function creditCycleEnd(start: Date, subscriptionPeriodEnd: Date): Date {
  const monthLater = addMonths(start, 1);
  return monthLater.getTime() < subscriptionPeriodEnd.getTime()
    ? monthLater
    : new Date(subscriptionPeriodEnd);
}

/**
 * Deduz o ciclo pela duração do período cobrado (ex.: linha de invoice do
 * Stripe). Mais de ~2 meses só pode ser anual.
 */
export function inferIntervalFromPeriod(
  start: Date,
  end: Date,
): BillingInterval {
  const days = (end.getTime() - start.getTime()) / 86_400_000;
  return days > 62 ? 'YEARLY' : 'MONTHLY';
}

export function parseBillingInterval(
  value: unknown,
  fallback: BillingInterval = 'MONTHLY',
): BillingInterval {
  if (value === 'YEARLY' || value === 'year') return 'YEARLY';
  if (value === 'MONTHLY' || value === 'month') return 'MONTHLY';
  return fallback;
}
