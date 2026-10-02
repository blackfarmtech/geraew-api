-- =====================================================================
-- Plano anual (cobrança anual com 20% OFF, créditos renovando todo mês).
--
-- O que muda:
--   enum "BillingInterval"          → MONTHLY | YEARLY
--   plan_prices.interval            → ciclo do preço. Um plano passa a ter
--                                     até 2 preços por moeda (mensal e anual).
--                                     Unique (plan_id, currency) vira
--                                     (plan_id, currency, interval).
--   subscriptions.billing_interval  → ciclo da assinatura. No YEARLY o
--                                     current_period_* cobre 1 ano, mas os
--                                     créditos renovam mensalmente via cron
--                                     (credit_balances.period_*).
--   subscriptions.scheduled_billing_interval
--                                   → ciclo que entra junto com
--                                     scheduled_plan_id na próxima renovação
--                                     (ex.: anual → mensal no vencimento).
--
-- Todas as linhas existentes ficam MONTHLY (default), então nada muda para
-- quem já assina.
--
-- Depois de aplicar, crie os preços anuais no Stripe e as linhas YEARLY em
-- plan_prices com:
--     npm run stripe:annual-prices            (dry-run, só mostra)
--     npm run stripe:annual-prices -- --apply (cria de verdade)
--
-- HOW TO APPLY (escolha uma):
--   1) Recomendado — deixar o Prisma aplicar (bate exatamente com o schema):
--        npx prisma db push
--   2) Ou rodar este SQL direto no banco de produção.
--
-- Idempotente: seguro rodar mais de uma vez. Roda numa transação só: se
-- algo falhar, nada é aplicado.
-- =====================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BillingInterval') THEN
    CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'YEARLY');
  END IF;
END
$$;

-- plan_prices -----------------------------------------------------------
ALTER TABLE "plan_prices"
  ADD COLUMN IF NOT EXISTS "interval" "BillingInterval" NOT NULL DEFAULT 'MONTHLY';

-- O unique antigo pode existir como índice (prisma db push) ou constraint.
ALTER TABLE "plan_prices" DROP CONSTRAINT IF EXISTS "plan_prices_plan_id_currency_key";
DROP INDEX IF EXISTS "plan_prices_plan_id_currency_key";

CREATE UNIQUE INDEX IF NOT EXISTS "plan_prices_plan_id_currency_interval_key"
  ON "plan_prices" ("plan_id", "currency", "interval");

-- subscriptions ---------------------------------------------------------
ALTER TABLE "subscriptions"
  ADD COLUMN IF NOT EXISTS "billing_interval" "BillingInterval" NOT NULL DEFAULT 'MONTHLY',
  ADD COLUMN IF NOT EXISTS "scheduled_billing_interval" "BillingInterval";

COMMIT;
