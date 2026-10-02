/**
 * Cria os preços ANUAIS (20% OFF) no Stripe e as linhas YEARLY em plan_prices.
 *
 * Para cada plano pago ativo × cada moeda com preço MENSAL ativo:
 *   - preço anual = annualPriceFromMonthly(mensal)  (12× o mensal − 20%)
 *   - cria um price recorrente anual no MESMO product do price mensal,
 *     com lookup_key `geraew_<slug>_<moeda>_yearly` (idempotente: se já existe
 *     com o mesmo valor, reaproveita; se o valor mudou, cria outro e transfere
 *     o lookup_key)
 *   - faz upsert da linha plan_prices (plan, moeda, YEARLY)
 *
 * Pré-requisito: prisma/migrations-manual/annual_billing.sql aplicado.
 *
 * Uso:
 *   npm run stripe:annual-prices              → DRY-RUN (só lê e mostra a tabela)
 *   npm run stripe:annual-prices -- --apply   → cria no Stripe e grava no banco
 *
 * ATENÇÃO: usa o STRIPE_SECRET_KEY e o DATABASE_URL do .env. Confira se é o
 * ambiente certo antes do --apply.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';
import {
  ANNUAL_DISCOUNT_PERCENT,
  annualPriceFromMonthly,
} from '../src/plans/billing-interval';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const APPLY = process.argv.includes('--apply');

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
  console.error('❌ STRIPE_SECRET_KEY not set in .env');
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2026-02-25.clover',
});
const prisma = new PrismaClient();

interface Row {
  plano: string;
  moeda: string;
  mensal: string;
  anual: string;
  'equiv/mês': string;
  stripe: string;
  banco: string;
  priceId: string;
}

const fmt = (cents: number) => (cents / 100).toFixed(2);

async function findByLookupKey(
  lookupKey: string,
): Promise<Stripe.Price | null> {
  const res = await stripe.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 1,
  });
  return res.data[0] ?? null;
}

async function main() {
  const mode = STRIPE_SECRET_KEY!.startsWith('sk_live') ? 'LIVE' : 'TEST';
  console.log(
    `\n${APPLY ? '⚠️  APPLY' : '🔎 DRY-RUN'} — Stripe ${mode} — desconto anual ${ANNUAL_DISCOUNT_PERCENT}%\n`,
  );

  const monthlyPrices = await prisma.planPrice.findMany({
    where: {
      interval: 'MONTHLY',
      isActive: true,
      plan: { isActive: true, slug: { not: 'free' } },
    },
    include: { plan: true },
    orderBy: [{ plan: { sortOrder: 'asc' } }, { currency: 'asc' }],
  });

  const rows: Row[] = [];
  const envLines: string[] = [];

  for (const monthly of monthlyPrices) {
    const { plan, currency } = monthly;
    const annualCents = annualPriceFromMonthly(monthly.priceCents);
    const lookupKey = `geraew_${plan.slug}_${currency.toLowerCase()}_yearly`;

    const monthlyStripePrice = await stripe.prices.retrieve(
      monthly.stripePriceId,
    );
    const productId =
      typeof monthlyStripePrice.product === 'string'
        ? monthlyStripePrice.product
        : monthlyStripePrice.product.id;

    const existing = await findByLookupKey(lookupKey);
    const existingMatches =
      !!existing &&
      existing.unit_amount === annualCents &&
      existing.currency === currency.toLowerCase() &&
      existing.recurring?.interval === 'year' &&
      (typeof existing.product === 'string'
        ? existing.product
        : existing.product.id) === productId;

    let stripeAction: string;
    let stripePriceId: string | null =
      existingMatches && existing ? existing.id : null;

    if (existingMatches) {
      stripeAction = 'já existe';
    } else {
      stripeAction = existing ? 'recriar (valor mudou)' : 'criar';
      if (APPLY) {
        const created = await stripe.prices.create({
          product: productId,
          currency: currency.toLowerCase(),
          unit_amount: annualCents,
          recurring: { interval: 'year', interval_count: 1 },
          lookup_key: lookupKey,
          transfer_lookup_key: true,
          nickname: `${plan.name} anual (${ANNUAL_DISCOUNT_PERCENT}% OFF)`,
          metadata: {
            slug: plan.slug,
            billing_interval: 'YEARLY',
            annual_discount_percent: String(ANNUAL_DISCOUNT_PERCENT),
            credits_per_month: String(plan.creditsPerMonth),
          },
        });
        stripePriceId = created.id;
      }
    }

    const dbRow = await prisma.planPrice.findUnique({
      where: {
        planId_currency_interval: {
          planId: plan.id,
          currency,
          interval: 'YEARLY',
        },
      },
    });
    const dbUpToDate =
      !!dbRow &&
      dbRow.isActive &&
      dbRow.priceCents === annualCents &&
      dbRow.stripePriceId === stripePriceId;
    const dbAction = dbUpToDate ? 'ok' : dbRow ? 'atualizar' : 'criar';

    if (APPLY && stripePriceId && !dbUpToDate) {
      await prisma.planPrice.upsert({
        where: {
          planId_currency_interval: {
            planId: plan.id,
            currency,
            interval: 'YEARLY',
          },
        },
        update: { priceCents: annualCents, stripePriceId, isActive: true },
        create: {
          planId: plan.id,
          currency,
          interval: 'YEARLY',
          priceCents: annualCents,
          stripePriceId,
        },
      });
    }

    rows.push({
      plano: plan.slug,
      moeda: currency,
      mensal: fmt(monthly.priceCents),
      anual: fmt(annualCents),
      'equiv/mês': fmt(Math.round(annualCents / 12)),
      stripe: stripeAction,
      banco: dbAction,
      priceId: stripePriceId ?? '(dry-run)',
    });

    if (stripePriceId) {
      const envKey = `STRIPE_PRICE_PLAN_${plan.slug.toUpperCase().replace(/-/g, '')}_YEARLY${currency === 'BRL' ? '' : `_${currency}`}`;
      envLines.push(`${envKey}=${stripePriceId}`);
    }
  }

  console.table(rows);

  if (envLines.length > 0) {
    console.log('\nVariáveis para o .env (usadas pelo prisma/seed.ts):');
    console.log(envLines.join('\n'));
  }

  if (!APPLY) {
    console.log('\nNada foi alterado. Rode com --apply para criar de verdade.');
  }
}

main()
  .catch((err) => {
    console.error('❌', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
