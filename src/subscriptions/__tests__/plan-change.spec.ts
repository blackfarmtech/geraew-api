import { BadRequestException } from '@nestjs/common';
import { classifyPlanChange, proratedUnusedCents } from '../plan-change';

const M = 'MONTHLY' as const;
const Y = 'YEARLY' as const;

describe('classifyPlanChange', () => {
  it.each([
    // [atual, ciclo atual, alvo, ciclo alvo, esperado]
    ['free', M, 'starter', M, 'upgrade'],
    ['free', M, 'pro', Y, 'upgrade'],
    ['starter', M, 'pro', M, 'upgrade'],
    ['pro', M, 'starter', M, 'scheduled'],
    ['pro', M, 'pro', Y, 'upgrade'], // mensal → anual no mesmo plano vale na hora
    ['starter', M, 'pro', Y, 'upgrade'],
    ['pro', M, 'starter', Y, 'scheduled'], // anual menor: só na renovação
    ['starter', Y, 'pro', Y, 'upgrade'],
    ['pro', Y, 'starter', Y, 'scheduled'],
    ['pro', Y, 'pro', M, 'scheduled'], // anual → mensal: fim do ano pago
    ['starter', Y, 'studio', M, 'scheduled'], // até subindo de plano
    ['pro', Y, 'free', Y, 'scheduled'],
    ['pro', M, 'pro', M, 'same'],
    ['pro', Y, 'pro', Y, 'same'],
  ] as const)(
    '%s/%s → %s/%s = %s',
    (currentSlug, currentInterval, targetSlug, targetInterval, expected) => {
      expect(
        classifyPlanChange(
          { slug: currentSlug, interval: currentInterval },
          { slug: targetSlug, interval: targetInterval },
        ),
      ).toBe(expected);
    },
  );

  it('rejeita plano fora da ordem conhecida', () => {
    expect(() =>
      classifyPlanChange(
        { slug: 'business', interval: M },
        { slug: 'pro', interval: M },
      ),
    ).toThrow(BadRequestException);
  });
});

describe('proratedUnusedCents', () => {
  const start = new Date('2026-01-01T00:00:00Z');
  const end = new Date('2027-01-01T00:00:00Z'); // 365 dias

  it('devolve o valor cheio no início do período', () => {
    expect(proratedUnusedCents(86304, start, end, start)).toBe(86304);
  });

  it('proporcional ao tempo restante (metade do ano ≈ metade do valor)', () => {
    const middle = new Date(
      start.getTime() + (end.getTime() - start.getTime()) / 2,
    );
    expect(proratedUnusedCents(86304, start, end, middle)).toBe(43152);
  });

  it('arredonda para baixo (nunca dá crédito a mais)', () => {
    const oneDay = new Date(start.getTime() + 86_400_000);
    // 86304 × 364/365 = 86067.55…
    expect(proratedUnusedCents(86304, start, end, oneDay)).toBe(86067);
  });

  it('zero depois do fim do período e com valor/período inválido', () => {
    expect(proratedUnusedCents(86304, start, end, new Date('2027-02-01'))).toBe(
      0,
    );
    expect(proratedUnusedCents(0, start, end, start)).toBe(0);
    expect(proratedUnusedCents(86304, end, start, start)).toBe(0);
  });

  it('nunca passa do valor pago mesmo com "agora" antes do início', () => {
    expect(proratedUnusedCents(86304, start, end, new Date('2025-06-01'))).toBe(
      86304,
    );
  });
});
