import { BadRequestException } from '@nestjs/common';
import { BillingInterval } from '@prisma/client';

export const PLAN_ORDER = [
  'free',
  'ultra-basic',
  'starter',
  'basic',
  'creator',
  'pro',
  'advanced',
  'studio',
];

/**
 * - `upgrade`: vale na hora, via novo checkout com crédito do que já foi pago.
 * - `scheduled`: entra só na próxima renovação (downgrade ou anual → mensal).
 * - `same`: mesmo plano e mesmo ciclo — nada a fazer.
 */
export type PlanChangeKind = 'upgrade' | 'scheduled' | 'same';

export interface PlanChangeSide {
  slug: string;
  interval: BillingInterval;
}

/**
 * Matriz de troca de plano (cartão/Stripe):
 *
 * | atual   | alvo                      | resultado  |
 * |---------|---------------------------|------------|
 * | free    | qualquer pago             | upgrade    |
 * | mensal  | mensal superior           | upgrade    |
 * | mensal  | mensal inferior           | scheduled  |
 * | mensal  | anual mesmo ou superior   | upgrade    |
 * | mensal  | anual inferior            | scheduled  |
 * | anual   | anual superior            | upgrade    |
 * | anual   | anual inferior            | scheduled  |
 * | anual   | mensal (qualquer)         | scheduled  |
 * | igual   | igual                     | same       |
 */
export function classifyPlanChange(
  current: PlanChangeSide,
  target: PlanChangeSide,
): PlanChangeKind {
  const currentIdx = PLAN_ORDER.indexOf(current.slug);
  const targetIdx = PLAN_ORDER.indexOf(target.slug);

  if (currentIdx === -1 || targetIdx === -1) {
    throw new BadRequestException(
      `Plano desconhecido na ordem de planos: ${current.slug} → ${target.slug}`,
    );
  }

  if (current.slug === target.slug && current.interval === target.interval) {
    return 'same';
  }

  if (current.slug === 'free') return 'upgrade';

  if (current.interval === 'MONTHLY') {
    if (target.interval === 'MONTHLY') {
      return targetIdx > currentIdx ? 'upgrade' : 'scheduled';
    }
    return targetIdx >= currentIdx ? 'upgrade' : 'scheduled';
  }

  // Anual: só sobe de plano mantendo o anual. Voltar pro mensal (mesmo que
  // num plano maior) ou descer de plano fica para o fim do ano já pago.
  if (target.interval === 'YEARLY' && targetIdx > currentIdx) {
    return 'upgrade';
  }
  return 'scheduled';
}

/**
 * Valor ainda não usufruído de um período pago, proporcional ao tempo que
 * falta. Usado como crédito no upgrade de quem está no anual.
 */
export function proratedUnusedCents(
  paidCents: number,
  periodStart: Date,
  periodEnd: Date,
  now: Date = new Date(),
): number {
  const total = periodEnd.getTime() - periodStart.getTime();
  if (paidCents <= 0 || total <= 0) return 0;
  const remaining = Math.min(
    Math.max(periodEnd.getTime() - now.getTime(), 0),
    total,
  );
  return Math.floor((paidCents * remaining) / total);
}
