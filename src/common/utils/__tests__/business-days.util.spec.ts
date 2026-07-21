import {
  businessDaysBetween,
  isBusinessDay,
  nextBusinessDay,
  toBrasiliaDateString,
} from '../business-days.util';

describe('business-days.util', () => {
  describe('toBrasiliaDateString', () => {
    it('converte instante UTC para a data civil brasileira', () => {
      // 19/07 00:08 UTC ainda é 18/07 no Brasil — era esse off-by-one que fazia
      // o cron mandar dueDate um dia depois do fim real do período.
      expect(toBrasiliaDateString(new Date('2026-07-19T00:08:59.376Z'))).toBe(
        '2026-07-18',
      );
      expect(toBrasiliaDateString(new Date('2026-07-19T18:15:44.694Z'))).toBe(
        '2026-07-19',
      );
    });
  });

  describe('isBusinessDay', () => {
    it('rejeita sábado e domingo', () => {
      expect(isBusinessDay('2026-07-18')).toBe(false); // sábado
      expect(isBusinessDay('2026-07-19')).toBe(false); // domingo
      expect(isBusinessDay('2026-07-20')).toBe(true); // segunda
    });

    it('rejeita feriados nacionais fixos', () => {
      expect(isBusinessDay('2026-09-07')).toBe(false); // Independência (segunda)
      expect(isBusinessDay('2026-12-25')).toBe(false); // Natal (sexta)
      expect(isBusinessDay('2026-11-20')).toBe(false); // Consciência Negra (sexta)
    });

    it('rejeita feriados móveis derivados da Páscoa', () => {
      // Páscoa 2026 = 05/04.
      expect(isBusinessDay('2026-04-03')).toBe(false); // Sexta-feira Santa
      expect(isBusinessDay('2026-02-16')).toBe(false); // Segunda de Carnaval
      expect(isBusinessDay('2026-02-17')).toBe(false); // Terça de Carnaval
      expect(isBusinessDay('2026-06-04')).toBe(false); // Corpus Christi
      // Páscoa 2027 = 28/03 → Sexta-feira Santa em 26/03.
      expect(isBusinessDay('2027-03-26')).toBe(false);
    });
  });

  describe('nextBusinessDay', () => {
    it('mantém a data quando já é dia útil', () => {
      expect(nextBusinessDay('2026-07-20')).toBe('2026-07-20');
    });

    it('empurra fim de semana para segunda', () => {
      expect(nextBusinessDay('2026-07-18')).toBe('2026-07-20');
      expect(nextBusinessDay('2026-07-19')).toBe('2026-07-20');
    });

    it('pula feriado emendado com fim de semana', () => {
      // 25/12/2026 é sexta → próximo dia útil é segunda 28/12.
      expect(nextBusinessDay('2026-12-25')).toBe('2026-12-28');
    });
  });

  describe('businessDaysBetween', () => {
    it('conta apenas dias úteis estritamente entre as pontas', () => {
      // qua 15/07 → dom 19/07: úteis no meio são 16 e 17 = 2.
      expect(businessDaysBetween('2026-07-15', '2026-07-19')).toBe(2);
      // qui 16/07 → seg 20/07: útil no meio é só 17 = 1.
      expect(businessDaysBetween('2026-07-16', '2026-07-20')).toBe(1);
    });

    it('retorna zero para dias consecutivos', () => {
      expect(businessDaysBetween('2026-07-20', '2026-07-21')).toBe(0);
    });

    it('desconta feriado no intervalo', () => {
      // 07/09/2026 (segunda, Independência) cai entre 04/09 e 11/09.
      // Úteis no meio: 08, 09, 10 = 3 (o dia 07 não conta).
      expect(businessDaysBetween('2026-09-04', '2026-09-11')).toBe(3);
    });

    it('é negativo quando a ordem se inverte', () => {
      expect(businessDaysBetween('2026-07-19', '2026-07-15')).toBe(-2);
    });
  });

  describe('regressão: a janela antiga violava o mínimo do BACEN', () => {
    it('2 a 4 dias corridos frequentemente rende menos de 2 dias úteis', () => {
      // Caso real: yovanny, vencimento seg 20/07, tentativas em 17 e 18/07.
      expect(businessDaysBetween('2026-07-17', '2026-07-20')).toBe(0);
      expect(businessDaysBetween('2026-07-18', '2026-07-20')).toBe(0);
    });

    it('a janela nova (alvo 7 dias úteis) fica folgada dentro de 2-10', () => {
      // Mesmo vencimento, criando 10 dias corridos antes.
      const antecedencia = businessDaysBetween('2026-07-10', '2026-07-20');
      expect(antecedencia).toBeGreaterThanOrEqual(3);
      expect(antecedencia).toBeLessThanOrEqual(10);
    });
  });
});
