-- =====================================================================
-- Saída da Vertex e do modo ilimitado (dados — sem mudança de schema).
--
-- 1) Veo 3.1 passa a rodar só pelo KIE:
--    - veo3 / veo3_fast (KIE) ganham o nome certo: "Veo 3.1 Quality" /
--      "Veo 3.1 Fast" (antes apareciam como "Geraew Quality/Fast").
--    - geraew-quality / geraew-fast (Veo via Vertex) ficam desativados. A API
--      já não usa esses slugs: os endpoints legados encaminham pro KIE.
--    - gemini-omni-video e sem-censura deixam de ser marcados como GERAEW
--      (rodam no KIE).
-- 2) Modo ilimitado descontinuado:
--    - zera unlimited_priority / unlimited_models dos planos (a API também já
--      ignora esses campos sem UNLIMITED_ENABLED=true);
--    - desativa avisos (announcements) que divulgam o ilimitado.
--
-- HOW TO APPLY: rodar este SQL direto no banco de produção, DEPOIS do deploy
-- da API nova (antes do deploy, desativar geraew-* quebraria a versão antiga
-- do front que ainda manda esses slugs).
--
-- Idempotente: seguro rodar mais de uma vez.
-- =====================================================================

BEGIN;

-- ── 1. Modelos de vídeo ──────────────────────────────────────────────
UPDATE "ai_models"
   SET "label" = 'Veo 3.1 Quality', "sort_order" = 3
 WHERE "slug" = 'veo3';

UPDATE "ai_models"
   SET "label" = 'Veo 3.1 Fast', "sort_order" = 4
 WHERE "slug" = 'veo3_fast';

UPDATE "ai_models"
   SET "is_active" = false,
       "status_message" = 'Descontinuado — use o Veo 3.1 (KIE).',
       "sort_order" = CASE "slug" WHEN 'geraew-quality' THEN 90 ELSE 91 END
 WHERE "slug" IN ('geraew-quality', 'geraew-fast');

UPDATE "ai_models"
   SET "provider" = 'KIE'
 WHERE "slug" IN ('gemini-omni-video', 'sem-censura')
   AND "provider" = 'GERAEW';

-- ── 2. Modo ilimitado ────────────────────────────────────────────────
UPDATE "plans"
   SET "unlimited_priority" = NULL,
       "unlimited_models" = NULL
 WHERE "unlimited_priority" IS NOT NULL
    OR "unlimited_models" IS NOT NULL;

UPDATE "announcements"
   SET "is_active" = false
 WHERE "is_active" = true
   AND (
        "variant" = 'unlimited'
     OR "cta_action"->>'type' = 'open-unlimited-modal'
     OR "title" ILIKE '%ilimitad%'
     OR "description" ILIKE '%ilimitad%'
     OR "translations"::text ILIKE '%unlimited%'
     OR "translations"::text ILIKE '%ilimitad%'
   );

COMMIT;

-- Conferência (opcional):
-- SELECT slug, label, provider, is_active, sort_order FROM ai_models WHERE type = 'VIDEO' ORDER BY sort_order;
-- SELECT slug, unlimited_priority, unlimited_models FROM plans ORDER BY sort_order;
-- SELECT slug, title, is_active FROM announcements WHERE variant = 'unlimited';
