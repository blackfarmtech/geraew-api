-- =====================================================================
-- Complemento do cadastro de perfil: campos de texto livre para "Outro".
-- Roda DEPOIS de onboarding_profile.sql.
--
-- Quando o usuário escolhe "Outro" em perfil ou nicho, o formulário abre
-- uma caixa de texto e a resposta cai nestas colunas:
--   profile_type_other → preenchida quando profile_type = 'OTHER'
--   niche_other        → preenchida quando niche = 'OTHER'
-- Nos outros casos ficam nulas (a API zera explicitamente).
--
-- HOW TO APPLY (escolha uma):
--   1) Recomendado — deixar o Prisma aplicar (bate exatamente com o schema):
--        npx prisma db push
--   2) Ou rodar este SQL direto no banco de produção.
--
-- Idempotente: seguro rodar mais de uma vez.
-- =====================================================================

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "profile_type_other" TEXT,
  ADD COLUMN IF NOT EXISTS "niche_other"        TEXT;
