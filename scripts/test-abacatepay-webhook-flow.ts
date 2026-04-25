/**
 * Teste end-to-end do webhook AbacatePay (sem ngrok).
 *
 *   1. Lê userId + packageId do banco (ou do PIX existente)
 *   2. Cria um PIX (ou reusa se PIX_ID for passado)
 *   3. Simula o pagamento no sandbox da AbacatePay → status PAID
 *   4. Chama POST localhost:<PORT>/api/v1/webhooks/abacatepay?webhookSecret=...
 *   5. Mostra o saldo de créditos antes vs depois
 *
 * IMPORTANTE: o pool do Supabase é pequeno (15 sessions). O script DESCONECTA
 * o Prisma antes de bater no webhook e RECONECTA pra ler o balance depois,
 * evitando "max clients reached".
 *
 * Run:
 *   npx ts-node scripts/test-abacatepay-webhook-flow.ts
 *   PIX_ID=pix_char_xxx npx ts-node scripts/test-abacatepay-webhook-flow.ts
 *   USER_EMAIL=eu@dominio.com npx ts-node scripts/test-abacatepay-webhook-flow.ts
 *   PACKAGE_NAME="Boost P" npx ts-node scripts/test-abacatepay-webhook-flow.ts
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const API_KEY = (process.env.ABACATEPAY_API_KEY ?? '').trim();
const WEBHOOK_SECRET = (process.env.ABACATEPAY_WEBHOOK_SECRET ?? '').trim();
const PORT = (process.env.PORT ?? '3000').trim();
const RAW_BASE = (process.env.ABACATEPAY_BASE_URL ?? 'https://api.abacatepay.com')
  .trim()
  .replace(/\/+$/, '')
  .replace(/\/v\d+$/, '');
const ABA_BASE = `${RAW_BASE}/v1`;
const LOCAL_BASE = `http://localhost:${PORT}/api/v1`;

const PIX_ID_ENV = process.env.PIX_ID;
const USER_EMAIL = process.env.USER_EMAIL;
const PACKAGE_NAME = process.env.PACKAGE_NAME;

if (!API_KEY) throw new Error('ABACATEPAY_API_KEY ausente no .env');
if (!WEBHOOK_SECRET) throw new Error('ABACATEPAY_WEBHOOK_SECRET ausente no .env');

async function abacatepay<T>(method: 'GET' | 'POST', p: string, body?: unknown): Promise<T> {
  const res = await fetch(`${ABA_BASE}${p}`, {
    method,
    headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const parsed = text ? JSON.parse(text) : {};
  if (!res.ok || parsed.success === false) {
    throw new Error(`AbacatePay ${method} ${p} → ${res.status}: ${JSON.stringify(parsed)}`);
  }
  return parsed.data as T;
}

function buildDbUrl(): string {
  const raw = process.env.DATABASE_URL ?? '';
  if (!raw) return raw;
  // Limite o script a 1 conexão para não estourar o pool do Supabase (15) compartilhado com o backend.
  const sep = raw.includes('?') ? '&' : '?';
  return raw.includes('connection_limit=') ? raw : `${raw}${sep}connection_limit=1&pool_timeout=10`;
}

async function withPrisma<T>(fn: (p: PrismaClient) => Promise<T>): Promise<T> {
  const prisma = new PrismaClient({
    datasources: { db: { url: buildDbUrl() } },
  });
  try {
    return await fn(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

interface PixSnapshot {
  id: string;
  amount: number;
  status: string;
  metadata?: Record<string, unknown> | null;
}

async function main() {
  console.log('🥑 AbacatePay — fluxo webhook end-to-end\n');

  // 1) Pegar user + package + saldo ANTES + criar PIX se necessário
  const setup = await withPrisma(async (prisma) => {
    let pix: PixSnapshot;
    let userId: string;
    let packageId: string;
    let userEmail: string | null = null;

    if (PIX_ID_ENV) {
      console.log(`→ Reusando PIX existente: ${PIX_ID_ENV}`);
      pix = await abacatepay<PixSnapshot>('GET', `/pixQrCode/check?id=${encodeURIComponent(PIX_ID_ENV)}`);
      const meta = (pix.metadata ?? {}) as Record<string, unknown>;
      userId = String(meta.userId ?? '');
      packageId = String(meta.packageId ?? '');
      if (!userId || !packageId) {
        throw new Error('PIX existente sem userId/packageId no metadata.');
      }
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
      userEmail = user?.email ?? null;
    } else {
      const user = await prisma.user.findFirst({
        where: USER_EMAIL ? { email: USER_EMAIL } : undefined,
        orderBy: { createdAt: 'asc' },
      });
      if (!user) throw new Error('Nenhum user encontrado.');
      const pkg = await prisma.creditPackage.findFirst({
        where: { isActive: true, ...(PACKAGE_NAME ? { name: PACKAGE_NAME } : {}) },
        orderBy: { sortOrder: 'asc' },
      });
      if (!pkg) throw new Error('Nenhum CreditPackage ativo.');

      console.log(`👤 User:    ${user.email}  (${user.id})`);
      console.log(`📦 Package: ${pkg.name}  (${pkg.credits} créditos · R$ ${(pkg.priceCents / 100).toFixed(2)})`);

      console.log('\n→ Criando PIX na AbacatePay…');
      pix = await abacatepay<PixSnapshot>('POST', '/pixQrCode/create', {
        amount: pkg.priceCents,
        description: `Boost — ${pkg.name}`.slice(0, 37),
        expiresIn: 3600,
        metadata: {
          userId: user.id,
          packageId: pkg.id,
          packageName: pkg.name,
          credits: pkg.credits,
          userEmail: user.email,
          userName: user.name,
        },
      });
      userId = user.id;
      packageId = pkg.id;
      userEmail = user.email;
      console.log(`   ✅ ${pix.id}  status=${pix.status}`);
    }

    const balance = await prisma.creditBalance.findUnique({ where: { userId } });
    return { pix, userId, packageId, userEmail, beforeBonus: balance?.bonusCreditsRemaining ?? 0 };
  });

  if (PIX_ID_ENV) {
    console.log(`👤 User: ${setup.userEmail ?? setup.userId}`);
    console.log(`📦 Package: ${setup.packageId}`);
  }
  console.log(`💰 Saldo bonus ANTES:  ${setup.beforeBonus}`);

  // 2) Simular pagamento (idempotente — se já estiver PAID, segue)
  if (setup.pix.status !== 'PAID') {
    console.log('\n→ Simulando pagamento (sandbox)…');
    const sim = await abacatepay<{ status: string }>(
      'POST',
      `/pixQrCode/simulate-payment?id=${encodeURIComponent(setup.pix.id)}`,
      { metadata: {} },
    );
    console.log(`   ✅ status=${sim.status}`);
    if (sim.status !== 'PAID') throw new Error(`Esperado PAID, veio ${sim.status}`);
  } else {
    console.log('\nℹ️  PIX já estava PAID — pulando simulate-payment.');
  }

  // 3) Webhook local — Prisma JÁ está desconectada (withPrisma fechou)
  console.log('\n→ POST no webhook local…');
  const webhookUrl = `${LOCAL_BASE}/webhooks/abacatepay?webhookSecret=${encodeURIComponent(WEBHOOK_SECRET)}`;
  const wRes = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'billing.paid', data: { id: setup.pix.id, status: 'PAID' } }),
  });
  const wText = await wRes.text();
  console.log(`   ${wRes.status} ${wRes.statusText} — ${wText}`);
  if (!wRes.ok) throw new Error(`Webhook handler retornou ${wRes.status}`);

  // 4) Verificar resultado
  await new Promise((r) => setTimeout(r, 500));
  await withPrisma(async (prisma) => {
    const balance = await prisma.creditBalance.findUnique({ where: { userId: setup.userId } });
    const afterBonus = balance?.bonusCreditsRemaining ?? 0;
    const delta = afterBonus - setup.beforeBonus;
    console.log(`\n💰 Saldo bonus DEPOIS: ${afterBonus}  (Δ ${delta >= 0 ? '+' : ''}${delta})`);

    const payment = await prisma.payment.findFirst({
      where: { externalPaymentId: setup.pix.id },
      select: { id: true, provider: true, status: true, amountCents: true, currency: true, createdAt: true },
    });
    console.log(`🧾 Payment row: ${payment ? JSON.stringify(payment) : 'NÃO ENCONTRADO'}`);

    const log = await prisma.webhookLog.findFirst({
      where: { provider: 'abacatepay', externalId: setup.pix.id },
      select: { processed: true, error: true },
    });
    console.log(`📓 webhook_log: ${log ? JSON.stringify(log) : 'NÃO ENCONTRADO'}`);

    if (payment?.status === 'COMPLETED' && payment.provider === 'abacatepay' && log?.processed) {
      console.log('\n🎉 Tudo OK: créditos liberados, payment registrado, webhook processado.');
    } else if (delta === 0 && payment) {
      console.log('\n⚠️  Idempotência: payment já existia. Crie um novo PIX pra um teste fresco.');
    } else {
      console.log('\n❌ Algo divergiu — veja o erro no webhook_log acima.');
    }
  });
}

main().catch((err) => {
  console.error('\n💥', err instanceof Error ? err.message : err);
  process.exit(1);
});
