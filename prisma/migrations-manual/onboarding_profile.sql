-- =====================================================================
-- Cadastro de perfil do usuário (nicho + contato).
-- Formulário curto exigido no primeiro acesso à plataforma para sabermos
-- quem é o usuário (seller, afiliado, fotógrafo, social media…), em que
-- nicho atua, onde vende e como falar com ele (WhatsApp / Instagram).
--
-- Colunas adicionadas em "users":
--   profile_completed_at  → null enquanto o usuário não respondeu (o modal
--                           continua aparecendo até responder)
--   profile_type          → SELLER | AFFILIATE | PHOTOGRAPHER | SOCIAL_MEDIA
--                           | BRAND_AGENCY | AI_SERVICES | OTHER
--   niche                 → FASHION | BEAUTY | HEALTH | FITNESS | HOME
--                           | ELECTRONICS | PET | FOOD | INFOPRODUCT
--                           | SERVICES | OTHER
--   sales_channels        → TIKTOK_SHOP | SHOPEE | MERCADO_LIVRE | AMAZON
--                           | INSTAGRAM | META_ADS | OWN_STORE | WHATSAPP
--                           | NOT_SELLING_YET
--   instagram_handle      → sem o "@"
-- A coluna "phone" já existia (E.164, ex: +5511912345678) e passa a ser
-- preenchida por este formulário.
--
-- HOW TO APPLY (escolha uma):
--   1) Recomendado — deixar o Prisma aplicar (bate exatamente com o schema):
--        npx prisma db push
--   2) Ou rodar este SQL direto no banco de produção.
--
-- Idempotente: seguro rodar mais de uma vez.
-- =====================================================================

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "profile_completed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "profile_type"         TEXT,
  ADD COLUMN IF NOT EXISTS "niche"                TEXT,
  ADD COLUMN IF NOT EXISTS "sales_channels"       TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "instagram_handle"     TEXT;

CREATE INDEX IF NOT EXISTS "users_profile_type_idx" ON "users"("profile_type");
CREATE INDEX IF NOT EXISTS "users_niche_idx"        ON "users"("niche");
