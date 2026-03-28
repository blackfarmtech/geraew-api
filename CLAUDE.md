# CLAUDE.md — AI Generation MicroSaaS Backend

## Visão Geral do Projeto

MicroSaaS de geração de imagens e vídeos com IA, similar ao Higgsfield. Público-alvo: creators e social media managers. Modelo freemium com sistema de créditos.

**Stack:** NestJS + TypeScript + PostgreSQL + Redis (BullMQ) + S3/R2

---

## Regras de Negócio

### Sistema de Créditos

Toda operação consome créditos fixos por geração (não por segundo).

#### Tabela de Consumo de Créditos

| Operação | Créditos | Custo API real | Base |
|---|---|---|---|
| NB2 1K | 90 | R$0,23 | Direto USD |
| NB2 2K | 130 | R$0,34 | Direto USD |
| NB2 4K | 190 | R$0,51 | Direto USD |
| NBPro 1K/2K | 190 | R$0,51 | Direto USD |
| NBPro 4K | 250 | R$0,68 | Direto USD |
| Motion Control 720p (por segundo) | 70 | R$0,17 | Direto USD |
| Motion Control 1080p (por segundo) | 100 | R$0,26 | Direto USD |
| Veo Fast 720p/1080p sem áudio (8s) | 600 | R$0,13 | Vertex A |
| Veo Fast 720p/1080p com áudio (8s) | 900 | R$0,20 | Vertex A |
| Veo Fast 4K sem áudio (8s) | 1600 | R$0,40 | Vertex A |
| Veo Fast 4K com áudio (8s) | 1800 | R$0,47 | Vertex A |
| Veo Max 720p/1080p sem áudio (8s) | 1000 | R$0,27 | Vertex A |
| Veo Max 720p/1080p com áudio (8s) | 2000 | R$0,53 | Vertex A |
| Veo Max 4K sem áudio (8s) | 2000 | R$0,53 | Vertex A |
| Veo Max 4K com áudio (8s) | 2800 | R$0,80 | Vertex A |

### Custos

- Custo fixo mensal: R$290 (Supabase + Hostinger + Storage)
- Câmbio adotado: R$5,67/USD
- Margem mínima alvo: 40%


#### Provedores de API

| Operação | Provedor | Modelo |
|---|---|---|
| Geração de Imagem (texto→imagem, imagem→imagem) | Google | Nano Banana 2 |
| Motion Control (imagem→vídeo com referência de movimento) | KuaiShou | Kling AI 2.6 |
| Geração de Vídeo / Vídeo+Áudio | Google | Veo 3.1 |

### Planos

| | Free | Starter | Creator | Pro | Studio |
|---|---|---|---|---|---|
| Preço | R$ 0 | R$ 39,90 | R$ 89,90 | R$ 179,90 | R$ 369,90 |
| Créditos | 300/dia | 4.000 | 12.000 | 30.000 | 80.000 |
| R$/crédito | — | R$ 0,00998 | R$ 0,00749 | R$ 0,00600 | R$ 0,00462 |
| Marca d'água | Sim | Não | Não | Não | Não |
| Gerações simultâneas | 1 | 2 | 3 | 5 | 10 |
| Retenção galeria | 30 dias | Ilimitado | Ilimitado | Ilimitado | Ilimitado |
| API access | Não | Não | Não | Não | Sim |
| Veo | Bloqueado | ✓ | ✓ | ✓ | ✓ |

### Pacotes de Créditos Avulsos (Boost)

| Pacote | Preço | Créditos | R$/crédito | vs Starter |
|---|---|---|---|---|
| Boost P | R$ 14,90 | 700 | R$ 0,0213 | +113% |
| Boost M | R$ 26,90 | 1.700 | R$ 0,0158 | +58% |
| Boost G | R$ 36,90 | 3.200 | R$ 0,0115 | +15% |

Nota: Boosts são sempre mais caros por crédito que qualquer plano (por design, para incentivar compra de plano).

### Regras de Créditos

- Free plan: **300 créditos por dia**, não acumula, reset diário à meia-noite
- Paid plans: créditos renovam na compra/renovação do plano
- Créditos não acumulam ao trocar de plano — renovam na nova compra
- Free plan: Veo Fast e Veo Max estão **bloqueados** (requer plano pago)
- Boost packages são sempre mais caros por crédito que qualquer plano
- Regra de ouro: Boost G (R$36,90/3.200cr) está R$3 abaixo do Starter (R$39,90/4.000cr) — UI destaca isso
- Na hora do débito, consumir primeiro créditos do plano, depois os avulsos (bônus)
- Gerações com status `failed` sempre devolvem créditos automaticamente

### Regras de Assinatura

- Renovação automática mensal
- Se pagamento falhar: retry em 3 dias e 7 dias
- Após 3 falhas: downgrade automático para Free
- Cancelamento: acesso até fim do período pago, depois vira Free
- Upgrade: imediato, créditos do novo plano são adicionados pro-rata
- Downgrade: efetivo no próximo ciclo

### Regras de Conteúdo

- Formatos de upload aceitos: PNG, JPG, WEBP (imagem), MP4 (vídeo referência)

---

## Schema do Banco de Dados (PostgreSQL)

### Enums

```sql
CREATE TYPE user_role AS ENUM ('user', 'admin');
CREATE TYPE subscription_status AS ENUM ('active', 'canceled', 'past_due', 'trialing');
CREATE TYPE generation_type AS ENUM ('text_to_image', 'image_to_image', 'text_to_video', 'image_to_video', 'motion_control');
CREATE TYPE generation_status AS ENUM ('processing', 'completed', 'failed');
CREATE TYPE credit_transaction_type AS ENUM ('subscription_renewal', 'purchase', 'generation_debit', 'generation_refund', 'referral_bonus', 'admin_adjustment');
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');
CREATE TYPE payment_type AS ENUM ('subscription', 'credit_purchase');
CREATE TYPE resolution AS ENUM ('1k', '2k', '4k', '720p', '1080p');
```

### Tabelas

```sql
-- ============================================
-- USERS
-- ============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255), -- null se login via OAuth
    name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    role user_role DEFAULT 'user',
    oauth_provider VARCHAR(50), -- 'google', null se email+senha
    oauth_provider_id VARCHAR(255),
    email_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_oauth ON users(oauth_provider, oauth_provider_id);

-- ============================================
-- PLANS
-- ============================================
CREATE TABLE plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(50) UNIQUE NOT NULL, -- 'free', 'starter', 'creator', 'pro', 'studio'
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price_cents INTEGER NOT NULL DEFAULT 0, -- em centavos de BRL
    credits_per_month INTEGER NOT NULL,
    max_concurrent_generations INTEGER NOT NULL DEFAULT 1,
    has_watermark BOOLEAN DEFAULT TRUE,
    gallery_retention_days INTEGER, -- null = ilimitado
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CREDIT COSTS (tabela de preços por operação)
-- ============================================
CREATE TABLE credit_costs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    generation_type generation_type NOT NULL,
    resolution resolution NOT NULL,
    has_audio BOOLEAN DEFAULT FALSE,
    credits_per_unit INTEGER NOT NULL, -- créditos por geração (fixo)
    is_per_second BOOLEAN DEFAULT FALSE, -- deprecated, sempre false no v4
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(generation_type, resolution, has_audio)
);

-- ============================================
-- CREDIT PACKAGES (pacotes avulsos)
-- ============================================
CREATE TABLE credit_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    credits INTEGER NOT NULL,
    price_cents INTEGER NOT NULL, -- em centavos de BRL
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SUBSCRIPTIONS
-- ============================================
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES plans(id),
    status subscription_status DEFAULT 'active',
    current_period_start TIMESTAMPTZ NOT NULL,
    current_period_end TIMESTAMPTZ NOT NULL,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    payment_provider VARCHAR(50), -- 'stripe', 'mercadopago'
    external_subscription_id VARCHAR(255),
    payment_retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_period_end ON subscriptions(current_period_end);

-- ============================================
-- CREDIT BALANCES
-- ============================================
CREATE TABLE credit_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_credits_remaining INTEGER NOT NULL DEFAULT 0, -- créditos do plano (expiram)
    bonus_credits_remaining INTEGER NOT NULL DEFAULT 0, -- créditos avulsos (não expiram)
    plan_credits_used INTEGER NOT NULL DEFAULT 0,
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_credit_balances_user ON credit_balances(user_id);

-- ============================================
-- CREDIT TRANSACTIONS (ledger de créditos)
-- ============================================
CREATE TABLE credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type credit_transaction_type NOT NULL,
    amount INTEGER NOT NULL, -- positivo = crédito, negativo = débito
    source VARCHAR(20) DEFAULT 'plan', -- 'plan' ou 'bonus' (qual saldo foi afetado)
    description TEXT,
    generation_id UUID REFERENCES generations(id) ON DELETE SET NULL,
    payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
    metadata JSONB, -- dados extras (ex: detalhes do hold)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_credit_transactions_user ON credit_transactions(user_id);
CREATE INDEX idx_credit_transactions_generation ON credit_transactions(generation_id);
CREATE INDEX idx_credit_transactions_type ON credit_transactions(type);
CREATE INDEX idx_credit_transactions_created ON credit_transactions(created_at);

-- ============================================
-- GENERATIONS
-- ============================================
CREATE TABLE generations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type generation_type NOT NULL,
    status generation_status DEFAULT 'pending',

    -- Input
    prompt TEXT,
    negative_prompt TEXT,
    input_image_url TEXT, -- S3 URL da imagem de input
    reference_video_url TEXT, -- S3 URL do vídeo de referência (motion control)

    -- Parâmetros
    resolution resolution NOT NULL,
    duration_seconds INTEGER, -- null para imagens
    has_audio BOOLEAN DEFAULT FALSE,
    model_used VARCHAR(100), -- 'nano-banana-2', 'kling-2.6', 'veo-3.1'
    parameters JSONB, -- parâmetros extras (steps, cfg_scale, seed, style, etc.)

    -- Output
    output_url TEXT, -- S3 URL do resultado final
    thumbnail_url TEXT, -- thumbnail para vídeos
    has_watermark BOOLEAN DEFAULT FALSE,

    -- Custos
    credits_consumed INTEGER NOT NULL DEFAULT 0,

    -- Metadata
    queue_priority queue_priority DEFAULT 'low',
    processing_started_at TIMESTAMPTZ,
    processing_time_ms INTEGER,
    error_message TEXT,

    -- Galeria
    is_favorited BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMPTZ, -- para planos com retenção limitada

    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_generations_user ON generations(user_id);
CREATE INDEX idx_generations_status ON generations(status);
CREATE INDEX idx_generations_type ON generations(type);
CREATE INDEX idx_generations_created ON generations(created_at DESC);
CREATE INDEX idx_generations_user_gallery ON generations(user_id, is_deleted, created_at DESC);
CREATE INDEX idx_generations_expires ON generations(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_generations_processing ON generations(status) WHERE status = 'processing';

-- ============================================
-- PAYMENTS
-- ============================================
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type payment_type NOT NULL,
    amount_cents INTEGER NOT NULL,
    currency VARCHAR(3) DEFAULT 'BRL',
    status payment_status DEFAULT 'pending',
    provider VARCHAR(50) NOT NULL, -- 'stripe', 'mercadopago'
    external_payment_id VARCHAR(255),
    external_invoice_id VARCHAR(255),
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    credit_package_id UUID REFERENCES credit_packages(id) ON DELETE SET NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_user ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_external ON payments(external_payment_id);

-- ============================================
-- REFRESH TOKENS
-- ============================================
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);

-- ============================================
-- WEBHOOKS LOG (para auditoria de webhooks recebidos)
-- ============================================
CREATE TABLE webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(50) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    external_id VARCHAR(255),
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhook_logs_provider ON webhook_logs(provider, event_type);
CREATE INDEX idx_webhook_logs_external ON webhook_logs(external_id);
```

### Seed dos Planos

```sql
INSERT INTO plans (slug, name, price_cents, credits_per_month, max_concurrent_generations, has_watermark, gallery_retention_days, has_api_access, has_veo_access, sort_order) VALUES
('free', 'Free', 0, 300, 1, true, 30, false, false, 0),
('starter', 'Starter', 3990, 4000, 2, false, null, false, true, 1),
('creator', 'Creator', 8990, 12000, 3, false, null, false, true, 2),
('pro', 'Pro', 17990, 30000, 5, false, null, false, true, 3),
('studio', 'Studio', 36990, 80000, 10, false, null, true, true, 4);
```

### Seed dos Custos de Crédito

```sql
INSERT INTO credit_costs (generation_type, resolution, has_audio, credits_per_unit, is_per_second) VALUES
-- Imagens NB2 (v4)
('text_to_image', '1k', false, 90, false),
('text_to_image', '2k', false, 130, false),
('text_to_image', '4k', false, 190, false),
('image_to_image', '1k', false, 90, false),
('image_to_image', '2k', false, 130, false),
('image_to_image', '4k', false, 190, false),
-- Imagens NBPro (v4)
-- NBPro 1K/2K = 190 créditos, NBPro 4K = 250 créditos
-- (diferenciação por modelo em parameters JSONB)
-- Motion Control (Kling 2.6) — por geração
('motion_control', '720p', false, 70, false),
('motion_control', '1080p', false, 100, false),
-- Veo Fast sem áudio (por geração, 8s)
('text_to_video', '720p', false, 600, false),
('text_to_video', '1080p', false, 600, false),
('text_to_video', '4k', false, 1600, false),
('image_to_video', '720p', false, 600, false),
('image_to_video', '1080p', false, 600, false),
('image_to_video', '4k', false, 1600, false),
-- Veo Fast com áudio (por geração, 8s)
('text_to_video', '720p', true, 900, false),
('text_to_video', '1080p', true, 900, false),
('text_to_video', '4k', true, 1800, false),
('image_to_video', '720p', true, 900, false),
('image_to_video', '1080p', true, 900, false),
('image_to_video', '4k', true, 1800, false);
-- Nota: Veo Max diferenciado por model_tier no código (1000/2000/2800 créditos)
```

### Seed dos Pacotes de Créditos (Boost)

```sql
INSERT INTO credit_packages (name, credits, price_cents, sort_order) VALUES
('Boost P', 700, 1490, 0),
('Boost M', 1700, 2690, 1),
('Boost G', 3200, 3690, 2);
```

---

## Fluxo de Geração (MVP — sem filas)

No MVP, a geração é processada em background diretamente no processo do NestJS, sem Redis ou BullMQ. O frontend faz polling para acompanhar o status.

### Fluxo Completo
/c
```
1. [API] POST /generations/:type
   ├── Calcula créditos necessários via credit_costs
   ├── Verifica saldo suficiente (plan_credits + bonus_credits >= custo)
   ├── Verifica limite de gerações simultâneas do plano
   ├── Debita créditos (credit_transaction tipo "generation_debit")
   ├── Cria registro generation (status: processing)
   ├── Dispara processamento em background (fire-and-forget Promise)
   └── Retorna imediatamente: { id, status: "processing", credits_consumed }

2. [Background — mesma instância] Processamento async
   ├── Atualiza generation.processing_started_at
   ├── Faz upload de inputs pro S3/R2 se necessário
   ├── Chama API externa (baseado no generation_type):
   │   ├── text_to_image / image_to_image → Google Nano Banana 2 API
   │   ├── motion_control → Kling AI 2.6 API
   │   └── text_to_video / image_to_video → Google Veo 3.1 API
   ├── Aguarda resposta (polling na API externa)
   ├── Faz download do resultado
   ├── Aplica marca d'água se plano Free
   ├── Upload resultado final pro S3/R2
   ├── Gera thumbnail (para vídeos)
   └── Atualiza generation:
       ├── status → "completed"
       ├── output_url, thumbnail_url
       ├── processing_time_ms
       └── completed_at

3. [Background] Em caso de FALHA
   ├── Retry simples (max 1 tentativa para erros de API)
   ├── Se falha definitiva:
   │   ├── Atualiza generation.status → "failed"
   │   ├── Atualiza generation.error_message e error_code
   │   └── Estorna créditos: credit_transaction tipo "generation_refund"

4. [Frontend] Polling
   ├── GET /generations/:id a cada 3 segundos
   ├── Quando status = "completed" → exibe resultado
   └── Quando status = "failed" → exibe erro + confirma estorno
```

### Implementação Simplificada

```typescript
// generations.service.ts — exemplo conceitual

async createGeneration(userId: string, dto: CreateGenerationDto) {
  // 1. Calcular créditos
  const cost = await this.creditCostsService.calculate(dto);

  // 2. Debitar créditos (transação atômica)
  await this.creditsService.debit(userId, cost, 'generation_debit');

  // 3. Criar registro
  const generation = await this.generationsRepo.save({
    userId,
    type: dto.type,
    status: 'processing',
    creditsConsumed: cost,
    ...dto,
  });

  // 4. Fire-and-forget — processar em background
  this.processGeneration(generation).catch((error) => {
    this.handleGenerationFailure(generation, error);
  });

  // 5. Retornar imediatamente
  return { id: generation.id, status: 'processing', creditsConsumed: cost };
}

private async processGeneration(generation: Generation) {
  const provider = this.getProvider(generation.type); // NanoBanana, Kling ou Veo
  const result = await provider.generate(generation);
  const outputUrl = await this.uploadService.upload(result);

  await this.generationsRepo.update(generation.id, {
    status: 'completed',
    outputUrl,
    completedAt: new Date(),
  });
}

private async handleGenerationFailure(generation: Generation, error: Error) {
  await this.generationsRepo.update(generation.id, {
    status: 'failed',
    errorMessage: error.message,
  });
  await this.creditsService.refund(generation.userId, generation.creditsConsumed, generation.id);
}
```

### Jobs Agendados (NestJS @Cron — sem Redis)

Usar o `@nestjs/schedule` com decorators `@Cron()` diretamente, sem filas.

```typescript
// cron/subscription-renewal.service.ts
@Cron('0 * * * *') // a cada hora
async handleSubscriptionRenewal() {
  // Busca subscriptions com current_period_end <= now() AND status = 'active'
  // Para cada: tenta cobrar via Stripe/MercadoPago
  // Se ok: renova período e reseta créditos
  // Se falha: marca past_due, incrementa retry_count
}

@Cron('0 */6 * * *') // a cada 6 horas
async handlePaymentRetry() {
  // Busca subscriptions com status = 'past_due'
  // Retry em +3 dias e +7 dias
  // Após 3 falhas → downgrade para Free
}

@Cron('0 3 * * *') // diariamente às 3AM
async handleGalleryCleanup() {
  // Busca generations com expires_at <= now()
  // Deleta arquivos do S3 e marca is_deleted = true
}

@Cron('*/15 * * * *') // a cada 15 minutos
async handleStuckGenerations() {
  // Busca generations com status = 'processing' AND created_at < now() - 10min
  // Marca como failed e estorna créditos (timeout/crash safety)
}
```

### Quando migrar para filas (BullMQ)

Adicionar BullMQ + Redis quando:
- Mais de ~50 gerações simultâneas travando o servidor
- Necessidade de prioridade real entre planos (Free espera, Pro passa na frente)
- Workers precisam escalar independentemente da API
- Necessidade de retry sofisticado com backoff exponencial

---

## Estrutura da API (REST)

### Base URL

```
/api/v1
```

### Autenticação

JWT Bearer Token. Access token (15min) + Refresh token (7 dias).

```
Authorization: Bearer <access_token>
```

### Endpoints

#### Auth

```
POST   /auth/register              → Cadastro com email+senha
POST   /auth/login                 → Login email+senha, retorna tokens
POST   /auth/google                → Login/cadastro via Google OAuth
POST   /auth/refresh               → Renova access token
POST   /auth/logout                → Revoga refresh token
POST   /auth/forgot-password       → Envia email de reset
POST   /auth/reset-password        → Reseta senha com token
```

#### Users

```
GET    /users/me                   → Perfil do usuário logado + plano + créditos
PATCH  /users/me                   → Atualiza perfil (name, avatar)
DELETE /users/me                   → Soft delete da conta
```

#### Plans

```
GET    /plans                      → Lista planos disponíveis (público)
```

#### Subscriptions

```
GET    /subscriptions/current      → Assinatura atual do usuário
POST   /subscriptions              → Cria assinatura (checkout)
PATCH  /subscriptions/upgrade      → Upgrade de plano
PATCH  /subscriptions/downgrade    → Downgrade de plano (efetivo próximo ciclo)
POST   /subscriptions/cancel       → Cancela assinatura (fim do período)
POST   /subscriptions/reactivate   → Reativa assinatura cancelada
```

#### Credits

```
GET    /credits/balance            → Saldo detalhado (plan + bonus)
GET    /credits/transactions       → Histórico de transações (paginado)
GET    /credits/packages           → Lista pacotes disponíveis
POST   /credits/purchase           → Compra pacote avulso (checkout)
GET    /credits/estimate           → Calcula custo de uma geração antes de executar
```

**Request exemplo — /credits/estimate:**
```json
POST /credits/estimate
{
  "type": "text_to_video",
  "resolution": "1080p",
  "duration_seconds": 5,
  "has_audio": true
}
// Response: { "credits_required": 480, "has_sufficient_balance": true }
```

#### Generations

```
POST   /generations/text-to-image       → Gera imagem a partir de texto
POST   /generations/image-to-image      → Gera imagem a partir de imagem + prompt
POST   /generations/text-to-video       → Gera vídeo a partir de texto
POST   /generations/image-to-video      → Gera vídeo a partir de imagem
POST   /generations/motion-control      → Gera vídeo com motion control
GET    /generations/:id                 → Status e detalhes de uma geração
GET    /generations                     → Lista gerações do usuário (paginado, filtros)
DELETE /generations/:id                 → Soft delete (remove da galeria)
POST   /generations/:id/favorite        → Marca como favorito
DELETE /generations/:id/favorite        → Remove favorito
```

**Request exemplo — text-to-image:**
```json
POST /generations/text-to-image
{
  "prompt": "A futuristic cityscape at sunset, cyberpunk style",
  "negative_prompt": "blurry, low quality",
  "resolution": "2k",
  "parameters": {
    "style": "cinematic",
    "seed": 42
  }
}
// Response: { "id": "uuid", "status": "pending", "credits_consumed": 15 }
```

**Request exemplo — motion-control:**
```json
POST /generations/motion-control
{
  "input_image": "<file upload ou S3 URL>",
  "reference_video": "<file upload ou S3 URL>",
  "resolution": "1080p",
  "duration_seconds": 5
}
// Response: { "id": "uuid", "status": "pending", "credits_consumed": 55 }
```

**Query params — GET /generations:**
```
?page=1
&limit=20
&type=text_to_image
&status=completed
&favorited=true
&sort=created_at:desc
```

#### Gallery (alias simplificado pra gerações completadas)

```
GET    /gallery                    → Lista gerações completadas (paginado)
GET    /gallery/stats              → Estatísticas (total gerado, créditos usados, etc.)
```

#### Webhooks (recebidos de provedores)

```
POST   /webhooks/stripe            → Eventos do Stripe
POST   /webhooks/mercadopago       → Eventos do Mercado Pago
```

#### Polling de Status (MVP — sem WebSocket)

O frontend faz polling no endpoint `GET /generations/:id` a cada 3-5 segundos para acompanhar o status da geração. Sem necessidade de WebSocket no MVP.

```
Frontend:
  1. POST /generations/text-to-image → recebe { id, status: "processing" }
  2. setInterval → GET /generations/:id a cada 3s
  3. Quando status = "completed" → para polling, exibe resultado
  4. Quando status = "failed" → para polling, exibe erro
```

#### Upload (pré-assinado)

```
POST   /uploads/presigned-url      → Gera URL pré-assinada pro S3/R2
```

```json
POST /uploads/presigned-url
{
  "filename": "photo.jpg",
  "content_type": "image/jpeg",
  "purpose": "generation_input" // ou "reference_video"
}
// Response: { "upload_url": "https://s3...", "file_key": "inputs/uuid/photo.jpg" }
```

#### Admin (protegido por role admin)

```
GET    /admin/stats                → Dashboard: receita, gerações, usuários ativos
GET    /admin/users                → Lista usuários (paginado, filtros)
GET    /admin/users/:id            → Detalhes de um usuário
PATCH  /admin/users/:id/credits    → Ajuste manual de créditos
GET    /admin/generations          → Todas as gerações (monitoramento)
```

---

## Estrutura de Módulos NestJS

```
src/
├── app.module.ts
├── main.ts
├── common/
│   ├── decorators/          → @CurrentUser, @Public, @Roles
│   ├── guards/              → JwtAuthGuard, RolesGuard, ThrottleGuard
│   ├── interceptors/        → TransformInterceptor, LoggingInterceptor
│   ├── filters/             → HttpExceptionFilter, AllExceptionsFilter
│   ├── pipes/               → ValidationPipe customizado
│   ├── dto/                 → PaginationDto, BaseResponseDto
│   └── utils/               → helpers genéricos
│
├── config/
│   ├── config.module.ts
│   ├── database.config.ts
│   ├── s3.config.ts
│   └── jwt.config.ts
│
├── database/
│   ├── database.module.ts
│   ├── migrations/
│   └── seeds/
│
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── strategies/          → JwtStrategy, GoogleStrategy
│   ├── guards/
│   └── dto/
│
├── users/
│   ├── users.module.ts
│   ├── users.controller.ts
│   ├── users.service.ts
│   ├── entities/            → user.entity.ts
│   └── dto/
│
├── plans/
│   ├── plans.module.ts
│   ├── plans.controller.ts
│   ├── plans.service.ts
│   ├── entities/            → plan.entity.ts, credit-cost.entity.ts, credit-package.entity.ts
│   └── dto/
│
├── subscriptions/
│   ├── subscriptions.module.ts
│   ├── subscriptions.controller.ts
│   ├── subscriptions.service.ts
│   ├── entities/            → subscription.entity.ts
│   └── dto/
│
├── credits/
│   ├── credits.module.ts
│   ├── credits.controller.ts
│   ├── credits.service.ts   → lógica de hold, débito, estorno, saldo
│   ├── entities/            → credit-balance.entity.ts, credit-transaction.entity.ts
│   └── dto/
│
├── generations/
│   ├── generations.module.ts
│   ├── generations.controller.ts
│   ├── generations.service.ts   → lógica de geração + processamento background
│   ├── entities/            → generation.entity.ts
│   ├── dto/
│   └── providers/           → adapters para cada API externa
│       ├── nano-banana.provider.ts
│       ├── kling.provider.ts
│       └── veo.provider.ts
│
├── gallery/
│   ├── gallery.module.ts
│   ├── gallery.controller.ts
│   └── gallery.service.ts
│
├── payments/
│   ├── payments.module.ts
│   ├── payments.controller.ts
│   ├── payments.service.ts
│   ├── entities/            → payment.entity.ts
│   ├── webhooks/            → stripe.webhook.ts, mercadopago.webhook.ts
│   └── dto/
│
├── uploads/
│   ├── uploads.module.ts
│   ├── uploads.controller.ts
│   └── uploads.service.ts   → S3/R2 presigned URLs
├── cron/
│   ├── cron.module.ts
│   ├── subscription-renewal.service.ts  → @Cron renovação mensal
│   ├── gallery-cleanup.service.ts       → @Cron limpeza de gerações expiradas
│   └── stuck-generations.service.ts     → @Cron detecta gerações travadas
│
├── admin/
│   ├── admin.module.ts
│   ├── admin.controller.ts
│   └── admin.service.ts
│
└── webhook-logs/
    ├── webhook-logs.module.ts
    ├── webhook-logs.service.ts
    └── entities/            → webhook-log.entity.ts
```

---

## Variáveis de Ambiente (.env)

```env
# App
NODE_ENV=development
PORT=3000
API_PREFIX=api/v1

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/ai_generator
DATABASE_SSL=false

# JWT
JWT_ACCESS_SECRET=your-access-secret
JWT_REFRESH_SECRET=your-refresh-secret
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3000/api/v1/auth/google/callback

# S3/R2 (Cloudflare R2 é compatível com S3)
S3_ENDPOINT=
S3_REGION=auto
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_BUCKET_NAME=ai-generations
S3_PUBLIC_URL= # CDN URL para servir arquivos

# APIs de Geração
NANO_BANANA_API_KEY=
NANO_BANANA_BASE_URL=
KLING_API_KEY=
KLING_BASE_URL=
VEO_API_KEY=
VEO_BASE_URL=

# Pagamentos
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
MERCADOPAGO_ACCESS_TOKEN=
MERCADOPAGO_WEBHOOK_SECRET=

# Rate Limiting
THROTTLE_TTL=60
THROTTLE_LIMIT=60

# Watermark
WATERMARK_IMAGE_PATH=assets/watermark.png
```

---

## Padrões e Convenções

### Respostas da API

```typescript
// Sucesso
{
  "success": true,
  "data": { ... },
  "meta": { "page": 1, "limit": 20, "total": 150 } // se paginado
}

// Erro
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_CREDITS",
    "message": "Créditos insuficientes. Necessário: 480, disponível: 200.",
    "statusCode": 402
  }
}
```

### Códigos de Erro Customizados

```
INSUFFICIENT_CREDITS        → 402 — Saldo insuficiente
MAX_CONCURRENT_REACHED      → 429 — Limite de gerações simultâneas
INVALID_FILE_TYPE           → 400 — Tipo de arquivo não suportado
FILE_TOO_LARGE              → 400 — Arquivo excede tamanho máximo
GENERATION_FAILED           → 500 — Erro na API externa
GENERATION_TIMEOUT          → 504 — Timeout na geração
PLAN_UPGRADE_REQUIRED       → 403 — Feature não disponível no plano atual
SUBSCRIPTION_PAST_DUE       → 402 — Pagamento pendente
NSFW_CONTENT_DETECTED       → 400 — Conteúdo NSFW detectado no prompt
PROMPT_TOO_LONG             → 400 — Prompt excede limite de caracteres
```

### Rate Limiting por Plano

```
Free:     30 req/min
Starter:  60 req/min
Creator:  90 req/min
Pro:      120 req/min
Studio:   300 req/min
```

### Validações Importantes

- Sempre calcular créditos server-side via tabela `credit_costs` (nunca confiar no client)
- Sempre verificar gerações simultâneas ativas antes de criar nova
- Sempre verificar se subscription está ativa antes de usar features do plano
- Débito de créditos deve ser atômico (usar transaction do PostgreSQL)
- Webhooks de pagamento devem ser idempotentes (checar via external_payment_id)
- Upload de arquivos sempre via presigned URL (nunca direto pela API)

---

## Deploy Sugerido

```
┌─────────────────────────────────────────┐
│              Cloudflare CDN             │
│         (cache de assets/outputs)       │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│           Load Balancer                 │
└──────────────────┬──────────────────────┘
                   │
         ┌─────────┴─────────┐
         │                   │
┌────────▼────────┐ ┌────────▼────────┐
│   NestJS API    │ │   NestJS API    │
│   (instance 1)  │ │   (instance 2)  │
│   + CRON jobs   │ │                 │
└────────┬────────┘ └────────┬────────┘
         │                   │
         └────────┬──────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
  ┌─────▼─────┐    ┌───────▼───────┐
  │ PostgreSQL │    │ Cloudflare R2 │
  │            │    │   (storage)   │
  └────────────┘    └───────────────┘
                          │
                  ┌───────┴───────┐
                  │   APIs IA     │
                  │ (Veo, Kling,  │
                  │  NanoBanana)  │
                  └───────────────┘
```

**Sugestão de infra MVP:**
- API: Railway, Render ou EasyPanel (Docker)
- DB: Neon (PostgreSQL serverless) ou Supabase
- Storage: Cloudflare R2 (egress grátis)
- CRON: roda na instância principal da API (apenas 1 instância executa CRONs)

**Nota:** Quando escalar para 2+ instâncias, usar flag/env para que apenas uma instância rode os CRONs, evitando duplicação.