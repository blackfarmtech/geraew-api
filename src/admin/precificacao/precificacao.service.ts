import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import * as path from 'path';
import Stripe from 'stripe';
import { PrismaService } from '../../prisma/prisma.service';
import { DEFAULT_PRICING_CONFIG, PricingConfig } from './precificacao.defaults';

const CONFIG_PATH = path.join(process.cwd(), 'data', 'pricing-config.json');
const CACHE_TTL_MS = 5 * 60_000;
const MS_MONTH = 86_400_000 * 30;

const INTERVAL_TO_MONTHS: Record<string, number> = {
  day: 1 / 30,
  week: 1 / 4.345,
  month: 1,
  year: 12,
};

interface CacheEntry<T> {
  expires: number;
  value: T;
}

export interface PricingFinance {
  mrrCents: number;
  /** MRR somado por moeda nativa (sem conversão) — fonte de verdade sem premissa de câmbio. */
  mrrByCurrency: { currency: string; nativeCents: number; subscriptions: number }[];
  /** Câmbio USD→BRL usado para combinar o MRR (editável). */
  mrrExchangeRateUsd: number;
  arpuCents: number;
  payingCustomers: number;
  pastDueCustomers: number;
  pastDueMrrCents: number;
  churnRateMonthly: number;
  churnedLast30d: number;
  newCustomersLast30d: number;
  ltvCents: number;
  ltvMonths: number;
  marginLast30d: number;
  costLast30dBrlCents: number;
  netRevenueLast30dCents: number;
}

@Injectable()
export class PrecificacaoService {
  private readonly logger = new Logger(PrecificacaoService.name);
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private readonly stripe: Stripe;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.stripe = new Stripe(this.config.getOrThrow<string>('STRIPE_SECRET_KEY'), {
      apiVersion: '2026-02-25.clover',
      maxNetworkRetries: 2,
    });
  }

  // ───────────────────────── Config (file-based, editável) ─────────────────────────

  async getConfig(): Promise<PricingConfig> {
    try {
      const raw = await fs.readFile(CONFIG_PATH, 'utf8');
      const parsed = JSON.parse(raw) as Partial<PricingConfig>;
      return { ...DEFAULT_PRICING_CONFIG, ...parsed };
    } catch {
      return DEFAULT_PRICING_CONFIG;
    }
  }

  async saveConfig(patch: Partial<PricingConfig>): Promise<PricingConfig> {
    const current = await this.getConfig();
    const next: PricingConfig = { ...current, ...patch };
    try {
      await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true });
      await fs.writeFile(CONFIG_PATH, JSON.stringify(next, null, 2), 'utf8');
    } catch (err) {
      this.logger.error(`Falha ao salvar pricing-config.json: ${String(err)}`);
      throw err;
    }
    this.cache.clear();
    return next;
  }

  // ───────────────────────── Report (cache + refresh) ─────────────────────────

  async getReport(refresh = false) {
    if (refresh) this.cache.clear();

    const config = await this.getConfig();

    // Banco (rápido) e Stripe (mais lento) em paralelo.
    const [consumption, features] = await Promise.all([
      this.memo('consumption', () => this.computeConsumption()),
      this.memo('features', () => this.computeFeatures()),
    ]);

    const finance = await this.memo('finance', () =>
      this.safe('finance', () =>
        this.computeFinance(features.totalCredits, config.blendedCostPerCreditBRL, config.exchangeRate),
      ),
    );

    return {
      generatedAt: Date.now(),
      config,
      costs: this.computeCosts(config),
      finance,
      consumption,
      features,
    };
  }

  private async memo<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const hit = this.cache.get(key);
    if (hit && hit.expires > now) return hit.value as T;
    const value = await loader();
    this.cache.set(key, { expires: now + CACHE_TTL_MS, value });
    return value;
  }

  /** Stripe pode falhar (rede/limite). Não derruba o relatório inteiro. */
  private async safe<T>(label: string, loader: () => Promise<T>): Promise<T | null> {
    try {
      return await loader();
    } catch (err) {
      this.logger.warn(`Métrica '${label}' indisponível: ${String(err)}`);
      return null;
    }
  }

  // ───────────────────────── Finanças (Stripe enxuto: 1 paginação) ─────────────────────────

  private async computeFinance(
    credits30d: number,
    blendedCostPerCreditBRL: number,
    exchangeRateUsd: number,
  ): Promise<PricingFinance> {
    const now = Date.now();
    const since30dSec = Math.floor((now - MS_MONTH) / 1000);

    // Paginação de assinaturas + cobranças dos últimos 30 dias, em paralelo.
    // Assinaturas: expande só o preço (sem cliente/produto = mais leve; usamos apenas o ID do cliente).
    const [subs, charges30d] = await Promise.all([
      (async () => {
        const out: Stripe.Subscription[] = [];
        for await (const s of this.stripe.subscriptions.list({
          status: 'all',
          limit: 100,
          expand: ['data.items.data.price'],
        })) {
          out.push(s);
          if (out.length >= 5000) break;
        }
        return out;
      })(),
      (async () => {
        const out: Stripe.Charge[] = [];
        for await (const c of this.stripe.charges.list({ created: { gte: since30dSec }, limit: 100 })) {
          out.push(c);
          if (out.length >= 5000) break;
        }
        return out;
      })(),
    ]);

    const custId = (s: Stripe.Subscription) => (typeof s.customer === 'string' ? s.customer : s.customer.id);
    const isRevenue = (s: Stripe.Subscription) => s.status === 'active' || s.status === 'trialing'; // conta no MRR
    const isPastDue = (s: Stripe.Subscription) => s.status === 'past_due';
    const endTimeMs = (s: Stripe.Subscription) => (s.canceled_at ?? s.ended_at ?? 0) * 1000;
    const since = now - MS_MONTH;

    // FX: BRL=1, USD=exchangeRateUsd (editável). EUR usa o mesmo placeholder (sem assinantes EUR ativos hoje).
    const fxFor = (currency: string) => (currency === 'BRL' ? 1 : exchangeRateUsd);
    const subCurrency = (s: Stripe.Subscription) => (s.items.data[0]?.price.currency ?? 'brl').toUpperCase();

    // Agrupa por CLIENTE (não por assinatura) — troca de plano não conta como churn.
    const byCust = new Map<string, Stripe.Subscription[]>();
    for (const s of subs) {
      const list = byCust.get(custId(s));
      if (list) list.push(s);
      else byCust.set(custId(s), [s]);
    }

    // MRR por moeda nativa — APENAS receita corrente (active/trialing). past_due fica de fora (vira "em atraso").
    const mrrNativeByCur = new Map<string, { nativeCents: number; subscriptions: number }>();
    for (const s of subs) {
      if (!isRevenue(s)) continue;
      const cur = subCurrency(s);
      const entry = mrrNativeByCur.get(cur) ?? { nativeCents: 0, subscriptions: 0 };
      entry.nativeCents += this.subscriptionMonthlyCents(s);
      entry.subscriptions += 1;
      mrrNativeByCur.set(cur, entry);
    }
    const mrrByCurrency = [...mrrNativeByCur.entries()]
      .map(([currency, v]) => ({ currency, nativeCents: v.nativeCents, subscriptions: v.subscriptions }))
      .sort((a, b) => b.nativeCents - a.nativeCents);
    const mrrCents = Math.round(
      mrrByCurrency.reduce((acc, c) => acc + c.nativeCents * fxFor(c.currency), 0),
    );

    // MRR em atraso (past_due) — receita em risco, mostrada num card à parte.
    const pastDueMrrCents = Math.round(
      subs.filter(isPastDue).reduce((acc, s) => acc + this.subscriptionMonthlyCents(s) * fxFor(subCurrency(s)), 0),
    );

    let payingCustomers = 0;
    let pastDueCustomers = 0;
    let retainedCustomers = 0;
    let churnedLast30d = 0;
    let newCustomersLast30d = 0;
    for (const [, list] of byCust) {
      const hasRevenue = list.some(isRevenue);
      const hasPastDue = list.some(isPastDue);
      if (hasRevenue) {
        payingCustomers++;
        const firstCreated = Math.min(...list.map((s) => s.created));
        if (firstCreated >= since30dSec) newCustomersLast30d++;
      } else if (hasPastDue) {
        pastDueCustomers++;
      }
      if (hasRevenue || hasPastDue) {
        // Ainda é cliente (não churnou) — inclui past_due.
        retainedCustomers++;
      } else {
        // Sem nenhuma assinatura ativa/em atraso: churnou se a última terminou nos últimos 30 dias.
        const lastEnd = Math.max(0, ...list.map(endTimeMs));
        if (lastEnd >= since && lastEnd <= now) churnedLast30d++;
      }
    }

    const base = retainedCustomers + churnedLast30d;
    const churnRateMonthly = base > 0 ? churnedLast30d / base : 0;
    const arpuCents = payingCustomers > 0 ? Math.round(mrrCents / payingCustomers) : 0;

    // Receita REAL dos últimos 30 dias (cobranças efetivadas − reembolsos) — para margem fiel.
    const grossRevenueLast30dCents = charges30d
      .filter((c) => c.status === 'succeeded')
      .reduce((acc, c) => acc + c.amount, 0);
    const refundedLast30dCents = charges30d.reduce((acc, c) => acc + c.amount_refunded, 0);
    const netRevenueLast30dCents = grossRevenueLast30dCents - refundedLast30dCents;

    // Custo = créditos consumidos (banco) × custo blended por crédito.
    const costLast30dBrlCents = Math.round(credits30d * blendedCostPerCreditBRL * 100);
    const marginLast30d =
      netRevenueLast30dCents > 0
        ? (netRevenueLast30dCents - costLast30dBrlCents) / netRevenueLast30dCents
        : 0;

    const grossMargin = Math.max(0.1, Math.min(0.95, marginLast30d || 0.5));
    const ltvMonths = churnRateMonthly > 0 ? 1 / churnRateMonthly : 24;
    const ltvCents = Math.round(arpuCents * grossMargin * ltvMonths);

    return {
      mrrCents,
      mrrByCurrency,
      mrrExchangeRateUsd: exchangeRateUsd,
      arpuCents,
      payingCustomers,
      pastDueCustomers,
      pastDueMrrCents,
      churnRateMonthly,
      churnedLast30d,
      newCustomersLast30d,
      ltvCents,
      ltvMonths,
      marginLast30d,
      costLast30dBrlCents,
      netRevenueLast30dCents,
    };
  }

  private subscriptionMonthlyCents(sub: Stripe.Subscription): number {
    let total = 0;
    for (const item of sub.items.data) {
      const price = item.price;
      if (!price.unit_amount) continue;
      const qty = item.quantity ?? 1;
      const interval = price.recurring?.interval ?? 'month';
      const intervalCount = price.recurring?.interval_count ?? 1;
      const intervalMonths = (INTERVAL_TO_MONTHS[interval] ?? 1) * intervalCount;
      if (intervalMonths <= 0) continue;
      total += (price.unit_amount * qty) / intervalMonths;
    }
    return Math.round(total);
  }

  // ───────────────────────── Custos computados a partir da config ─────────────────────────

  private computeCosts(config: PricingConfig) {
    const rate = config.exchangeRate;
    const aiCosts = config.aiCosts.map((c) => {
      const brl = c.usd * rate;
      let exampleBRL: number | null = null;
      if (c.unit === 'segundo') {
        const seconds = c.group === 'motion' ? config.motionSeconds : config.videoSeconds;
        exampleBRL = brl * seconds;
      }
      return { ...c, brl: round(brl, 4), exampleBRL: exampleBRL === null ? null : round(exampleBRL, 2) };
    });

    const sorted = [...aiCosts].sort((a, b) => (a.exampleBRL ?? a.brl) - (b.exampleBRL ?? b.brl));
    const infraTotal = config.infra.reduce((acc, i) => acc + i.monthlyBRL, 0);

    return {
      exchangeRate: rate,
      kieCreditUsd: config.kieCreditUsd,
      blendedCostPerCreditBRL: config.blendedCostPerCreditBRL,
      videoSeconds: config.videoSeconds,
      motionSeconds: config.motionSeconds,
      aiCosts,
      infra: config.infra,
      infraTotalBRL: round(infraTotal, 2),
      cheapest: sorted.slice(0, 5),
      mostExpensive: sorted.slice(-5).reverse(),
    };
  }

  // ───────────────────────── Consumo por cliente (banco, ao vivo) ─────────────────────────

  private async computeConsumption() {
    const rows = await this.prisma.$queryRawUnsafe<
      { user_id: string; plan_slug: string; plan_credits: number; credits: number; gens: number }[]
    >(`
      WITH paid AS (
        SELECT DISTINCT ON (s.user_id) s.user_id, p.slug AS plan_slug,
               p.credits_per_month AS plan_credits, p.price_cents
        FROM subscriptions s
        JOIN plans p ON p.id = s.plan_id
        WHERE s.status IN ('ACTIVE','TRIALING','PAST_DUE')
          AND p.price_cents > 0
          AND p.slug <> 'business'
        ORDER BY s.user_id, s.created_at DESC
      ),
      cons AS (
        SELECT user_id, SUM(credits_consumed)::int AS credits, COUNT(*)::int AS gens
        FROM generations
        WHERE created_at >= now() - interval '30 days' AND status = 'COMPLETED'
        GROUP BY user_id
      )
      SELECT paid.user_id, paid.plan_slug, paid.plan_credits::int AS plan_credits,
             COALESCE(cons.credits,0)::int AS credits, COALESCE(cons.gens,0)::int AS gens
      FROM paid LEFT JOIN cons ON cons.user_id = paid.user_id
    `);

    const credits = rows.map((r) => r.credits).sort((a, b) => a - b);
    const gens = rows.map((r) => r.gens).sort((a, b) => a - b);
    const n = credits.length;
    const pct = (p: number) => (n ? credits[Math.min(n - 1, Math.floor((p / 100) * n))] : 0);
    const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

    const byPlan: Record<string, { plan: string; n: number; avgConsumo: number; franquia: number; pctFranquia: number | null }> = {};
    for (const r of rows) {
      const b = (byPlan[r.plan_slug] ??= { plan: r.plan_slug, n: 0, avgConsumo: 0, franquia: r.plan_credits, pctFranquia: null });
      b.n++;
      b.avgConsumo += r.credits;
    }
    const perPlan = Object.values(byPlan).map((b) => {
      const avg = Math.round(b.avgConsumo / b.n);
      return { plan: b.plan, n: b.n, avgConsumo: avg, franquia: b.franquia, pctFranquia: b.franquia ? Math.round((avg / b.franquia) * 100) : null };
    }).sort((a, b) => a.franquia - b.franquia);

    return {
      payingUsers: n,
      normalP50: pct(50),
      mean: n ? Math.round(sum(credits) / n) : 0,
      p75: pct(75),
      heavyP90: pct(90),
      p95: pct(95),
      max: credits[n - 1] ?? 0,
      zeroConsumo: rows.filter((r) => r.credits === 0).length,
      gensMedian: n ? gens[Math.floor(n / 2)] : 0,
      gensMax: gens[n - 1] ?? 0,
      perPlan,
    };
  }

  // ───────────────────────── Recursos mais usados vs mais caros (banco, ao vivo) ─────────────────────────

  private async computeFeatures() {
    const [byType, byModel] = await Promise.all([
      this.prisma.$queryRawUnsafe<{ type: string; gens: number; credits: number; usuarios: number }[]>(`
        SELECT type::text AS type, COUNT(*)::int AS gens, SUM(credits_consumed)::int AS credits,
               COUNT(DISTINCT user_id)::int AS usuarios
        FROM generations
        WHERE created_at >= now() - interval '30 days' AND status = 'COMPLETED'
        GROUP BY type ORDER BY gens DESC
      `),
      this.prisma.$queryRawUnsafe<{ model_used: string; gens: number; credits: number; usuarios: number }[]>(`
        SELECT model_used, COUNT(*)::int AS gens, SUM(credits_consumed)::int AS credits,
               COUNT(DISTINCT user_id)::int AS usuarios
        FROM generations
        WHERE created_at >= now() - interval '30 days' AND status = 'COMPLETED'
        GROUP BY model_used ORDER BY credits DESC
      `),
    ]);

    const totGens = byType.reduce((a, r) => a + r.gens, 0);
    const totCred = byType.reduce((a, r) => a + r.credits, 0);
    const decorate = <T extends { gens: number; credits: number }>(arr: T[]) =>
      arr.map((r) => ({
        ...r,
        pctGens: totGens ? round((r.gens / totGens) * 100, 1) : 0,
        pctCredits: totCred ? round((r.credits / totCred) * 100, 1) : 0,
        creditsPerGen: r.gens ? Math.round(r.credits / r.gens) : 0,
      }));

    return {
      totalGens: totGens,
      totalCredits: totCred,
      byType: decorate(byType),
      byModel: decorate(byModel).slice(0, 15),
    };
  }
}

function round(v: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(v * f) / f;
}
