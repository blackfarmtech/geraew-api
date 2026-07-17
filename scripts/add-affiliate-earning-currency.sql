-- ============================================================================
-- affiliate_earnings.currency — moeda da comissão
--
-- Contexto: o produto cobra em BRL, USD e EUR e Payment.currency sempre soube
-- disso, mas a comissão do afiliado era gravada sem moeda. O painel assumia BRL,
-- então uma compra em dólar aparecia como "R$" e os saldos somavam moedas
-- diferentes no mesmo total.
--
-- Este script adiciona a coluna e corrige o histórico a partir do pagamento
-- vinculado, que é o dado autoritativo.
--
-- Rode os passos em ordem. O passo 1 é só leitura — confira o resultado antes
-- de seguir. Os passos 2 e 3 são idempotentes (pode rodar de novo sem estragar).
-- ============================================================================


-- ─── 1. DIAGNÓSTICO (só leitura — rode antes de mudar qualquer coisa) ───────
-- Mostra quantas comissões existem por moeda real do pagamento. Tudo que não
-- for BRL está sendo exibido errado hoje.

SELECT
  UPPER(p.currency)        AS moeda_real,
  COUNT(*)                 AS comissoes,
  SUM(ae.commission_cents) AS total_cents
FROM affiliate_earnings ae
JOIN payments p ON p.id = ae.payment_id
GROUP BY UPPER(p.currency)
ORDER BY comissoes DESC;


-- ─── 2. ADICIONA A COLUNA ───────────────────────────────────────────────────
-- DEFAULT 'BRL' faz as linhas existentes nascerem como BRL; o passo 3 corrige
-- as que não são. Bate com `currency String @default("BRL")` no schema.prisma.

ALTER TABLE affiliate_earnings
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'BRL';


-- ─── 3. BACKFILL A PARTIR DO PAGAMENTO ──────────────────────────────────────
-- Copia a moeda do payment vinculado. UPPER porque a Stripe manda 'usd'
-- minúsculo e o código grava maiúsculo.

UPDATE affiliate_earnings ae
SET currency = UPPER(p.currency)
FROM payments p
WHERE ae.payment_id = p.id
  AND ae.currency IS DISTINCT FROM UPPER(p.currency);


-- ─── 4. CONFERÊNCIA ─────────────────────────────────────────────────────────
-- (a) Distribuição final. Deve bater exatamente com o passo 1.

SELECT currency, COUNT(*) AS comissoes, SUM(commission_cents) AS total_cents
FROM affiliate_earnings
GROUP BY currency
ORDER BY comissoes DESC;

-- (b) Nenhuma linha pode divergir do pagamento. O esperado é 0.

SELECT COUNT(*) AS divergentes
FROM affiliate_earnings ae
JOIN payments p ON p.id = ae.payment_id
WHERE ae.currency <> UPPER(p.currency);

-- (c) Comissões que não são em real, com nome do afiliado e de quem comprou.
--     É aqui que a comissão do Ricardo deve aparecer como USD.

SELECT
  a.name          AS afiliado,
  u.email         AS comprador,
  ae.currency,
  ae.commission_cents,
  ae.status,
  ae.created_at
FROM affiliate_earnings ae
JOIN affiliates a ON a.id = ae.affiliate_id
JOIN users u      ON u.id = ae.user_id
WHERE ae.currency <> 'BRL'
ORDER BY ae.created_at DESC;
