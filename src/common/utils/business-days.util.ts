/**
 * Utilitários de dias úteis no fuso de Brasília (America/Sao_Paulo).
 *
 * Usado pelo PIX Automático: o BACEN exige que a instrução de cobrança seja
 * criada entre 2 e 10 dias úteis antes do vencimento, e o débito só ocorre em
 * dia útil. Tudo aqui trabalha com data civil brasileira no formato YYYY-MM-DD
 * pra evitar o off-by-one de UTC (um período que termina 19/07 00:08 UTC é
 * 18/07 no Brasil).
 */

const SP_OFFSET_MS = 3 * 60 * 60 * 1000; // BRT = UTC-3 (sem horário de verão desde 2019)

/** Converte um instante (Date/UTC) na data civil brasileira YYYY-MM-DD. */
export function toBrasiliaDateString(date: Date): string {
  return new Date(date.getTime() - SP_OFFSET_MS).toISOString().slice(0, 10);
}

/** Data civil brasileira de hoje. */
export function todayInBrasilia(now: Date = new Date()): string {
  return toBrasiliaDateString(now);
}

function parse(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00Z`);
}

function format(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). Base dos feriados
 * móveis brasileiros, que assim não precisam de manutenção anual.
 */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

const holidayCache = new Map<number, Set<string>>();

/**
 * Feriados nacionais brasileiros do ano. Não inclui feriados estaduais ou
 * municipais — o SPI opera em calendário nacional.
 */
function nationalHolidays(year: number): Set<string> {
  const cached = holidayCache.get(year);
  if (cached) return cached;

  const easter = easterSunday(year);
  const dates = new Set<string>([
    `${year}-01-01`, // Confraternização Universal
    `${year}-04-21`, // Tiradentes
    `${year}-05-01`, // Dia do Trabalho
    `${year}-09-07`, // Independência
    `${year}-10-12`, // Nossa Senhora Aparecida
    `${year}-11-02`, // Finados
    `${year}-11-15`, // Proclamação da República
    `${year}-11-20`, // Consciência Negra (nacional desde 2024, Lei 14.759/2023)
    `${year}-12-25`, // Natal
    format(addDays(easter, -48)), // Segunda de Carnaval
    format(addDays(easter, -47)), // Terça de Carnaval
    format(addDays(easter, -2)), // Sexta-feira Santa
    format(addDays(easter, 60)), // Corpus Christi
  ]);

  holidayCache.set(year, dates);
  return dates;
}

/** True se a data (YYYY-MM-DD) é dia útil bancário no Brasil. */
export function isBusinessDay(dateStr: string): boolean {
  const d = parse(dateStr);
  const weekday = d.getUTCDay();
  if (weekday === 0 || weekday === 6) return false;
  return !nationalHolidays(d.getUTCFullYear()).has(dateStr);
}

/** Primeiro dia útil em ou após a data informada. */
export function nextBusinessDay(dateStr: string): string {
  let d = parse(dateStr);
  // Limite de segurança: nenhuma sequência de não-úteis passa de ~10 dias.
  for (let i = 0; i < 15; i++) {
    const s = format(d);
    if (isBusinessDay(s)) return s;
    d = addDays(d, 1);
  }
  return format(d);
}

/** Avança `n` dias úteis a partir da data (a data inicial não é contada). */
export function addBusinessDays(dateStr: string, n: number): string {
  let d = parse(dateStr);
  let remaining = n;
  while (remaining > 0) {
    d = addDays(d, 1);
    if (isBusinessDay(format(d))) remaining--;
  }
  return format(d);
}

/**
 * Quantidade de dias úteis estritamente entre `from` e `to` (exclusivo nas
 * duas pontas) — é assim que se conta "criar N dias úteis antes do
 * vencimento": a antecedência é o número de dias úteis que separam a criação
 * do vencimento.
 *
 * Retorna número negativo se `to` for anterior a `from`.
 */
export function businessDaysBetween(fromStr: string, toStr: string): number {
  const from = parse(fromStr);
  const to = parse(toStr);
  if (to < from) return -businessDaysBetween(toStr, fromStr);

  let count = 0;
  let cursor = addDays(from, 1);
  while (cursor < to) {
    if (isBusinessDay(format(cursor))) count++;
    cursor = addDays(cursor, 1);
  }
  return count;
}
