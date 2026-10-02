import {
  ANNUAL_DISCOUNT_PERCENT,
  addBillingInterval,
  addMonths,
  annualDiscountPercent,
  annualPriceFromMonthly,
  creditCycleEnd,
  inferIntervalFromPeriod,
  parseBillingInterval,
} from '../billing-interval';

describe('billing-interval', () => {
  it('desconto do anual é 20%', () => {
    expect(ANNUAL_DISCOUNT_PERCENT).toBe(20);
  });

  it.each([
    [1290, 12384],
    [3990, 38304],
    [5990, 57504],
    [8990, 86304],
    [17990, 172704],
    [24990, 239904],
    [36990, 355104],
    [290, 2784],
  ])('annualPriceFromMonthly(%i) = %i (12× − 20%%)', (monthly, annual) => {
    expect(annualPriceFromMonthly(monthly)).toBe(annual);
    expect(annualDiscountPercent(annual, monthly)).toBe(20);
  });

  it('annualDiscountPercent com mensal zerado não divide por zero', () => {
    expect(annualDiscountPercent(1000, 0)).toBe(0);
  });

  describe('addMonths', () => {
    it('mantém o dia quando existe no mês de destino', () => {
      expect(addMonths(new Date(2026, 2, 15, 10), 1)).toEqual(
        new Date(2026, 3, 15, 10),
      );
    });

    it('limita ao último dia do mês (31/01 + 1 = 28/02)', () => {
      expect(addMonths(new Date(2026, 0, 31, 10), 1)).toEqual(
        new Date(2026, 1, 28, 10),
      );
    });

    it('ano bissexto (31/01/2028 + 1 = 29/02/2028)', () => {
      expect(addMonths(new Date(2028, 0, 31, 10), 1)).toEqual(
        new Date(2028, 1, 29, 10),
      );
    });

    it('vira o ano', () => {
      expect(addMonths(new Date(2026, 11, 10), 1)).toEqual(
        new Date(2027, 0, 10),
      );
    });
  });

  it('addBillingInterval soma 1 mês ou 12 meses', () => {
    const d = new Date(2026, 4, 20, 9);
    expect(addBillingInterval(d, 'MONTHLY')).toEqual(new Date(2026, 5, 20, 9));
    expect(addBillingInterval(d, 'YEARLY')).toEqual(new Date(2027, 4, 20, 9));
  });

  describe('creditCycleEnd', () => {
    it('1 mês depois do início quando o período pago é maior', () => {
      const start = new Date(2026, 0, 10);
      expect(creditCycleEnd(start, new Date(2027, 0, 10))).toEqual(
        new Date(2026, 1, 10),
      );
    });

    it('limitado ao fim do período pago', () => {
      const start = new Date(2026, 11, 20);
      const periodEnd = new Date(2027, 0, 5);
      expect(creditCycleEnd(start, periodEnd)).toEqual(periodEnd);
    });

    it('no mensal coincide com o fim do período', () => {
      const start = new Date(2026, 0, 10);
      const periodEnd = addBillingInterval(start, 'MONTHLY');
      expect(creditCycleEnd(start, periodEnd)).toEqual(periodEnd);
    });
  });

  it('inferIntervalFromPeriod pela duração', () => {
    const start = new Date('2026-01-01T00:00:00Z');
    expect(
      inferIntervalFromPeriod(start, new Date('2026-02-01T00:00:00Z')),
    ).toBe('MONTHLY');
    expect(
      inferIntervalFromPeriod(start, new Date('2027-01-01T00:00:00Z')),
    ).toBe('YEARLY');
  });

  it('parseBillingInterval aceita enum e o formato do Stripe', () => {
    expect(parseBillingInterval('YEARLY')).toBe('YEARLY');
    expect(parseBillingInterval('year')).toBe('YEARLY');
    expect(parseBillingInterval('month')).toBe('MONTHLY');
    expect(parseBillingInterval(undefined)).toBe('MONTHLY');
    expect(parseBillingInterval('weird', 'YEARLY')).toBe('YEARLY');
  });
});
