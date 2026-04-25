/**
 * Teste rápido de integração com AbacatePay (Checkout Transparente / PIX).
 *
 * A chave abc_dev_* é da API v1. Este script usa /v1/pixQrCode/*.
 * Para chaves v2, troque ABACATEPAY_API_VERSION=v2 (endpoints viram /v2/transparents/*
 * e o body fica { method: "PIX", data: {...} }).
 *
 * Fluxo:
 *   1. Cria PIX QR Code de R$ 1,00
 *   2. Salva o QR (PNG base64) em scripts/abacatepay-qr.png
 *   3. Imprime o brCode (copia-e-cola)
 *   4. Em sandbox (devMode), simula o pagamento e checa o status
 *
 * Run:
 *   npx ts-node scripts/test-abacatepay.ts
 *   npx ts-node scripts/test-abacatepay.ts --no-simulate
 *   AMOUNT_CENTS=2500 npx ts-node scripts/test-abacatepay.ts
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const API_KEY = (process.env.ABACATEPAY_API_KEY ?? '').trim();
const RAW_BASE = (process.env.ABACATEPAY_BASE_URL ?? 'https://api.abacatepay.com').trim();
const VERSION = (process.env.ABACATEPAY_API_VERSION ?? 'v1').trim().toLowerCase();

if (!API_KEY) {
  console.error('❌ ABACATEPAY_API_KEY não definida no .env');
  process.exit(1);
}

const baseRoot = RAW_BASE.replace(/\/+$/, '').replace(/\/v\d+$/, '');
const BASE_URL = `${baseRoot}/${VERSION}`;

const PATHS = VERSION === 'v2'
  ? {
      create: '/transparents/create',
      check: '/transparents/check',
      simulate: '/transparents/simulate-payment',
    }
  : {
      create: '/pixQrCode/create',
      check: '/pixQrCode/check',
      simulate: '/pixQrCode/simulate-payment',
    };

const isDevKey = API_KEY.startsWith('abc_dev_');
const skipSimulate = process.argv.includes('--no-simulate');
const amountCents = Number.parseInt(process.env.AMOUNT_CENTS ?? '100', 10);

async function call<T = any>(
  method: 'GET' | 'POST',
  pathname: string,
  body?: unknown,
): Promise<T> {
  const url = `${BASE_URL}${pathname}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let parsed: any;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text };
  }

  if (!res.ok) {
    console.error(`\n❌ ${method} ${url} → ${res.status}`);
    console.error(JSON.stringify(parsed, null, 2));
    throw new Error(`AbacatePay ${res.status}: ${parsed?.error ?? text}`);
  }

  return parsed as T;
}

type PixData = {
  id: string;
  amount: number;
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED' | 'REFUNDED';
  devMode: boolean;
  brCode: string;
  brCodeBase64: string;
  platformFee: number;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
};

type PixResponse = { data: PixData; success: boolean; error: string | null };

function buildCreateBody() {
  const payload = {
    amount: amountCents,
    description: 'Teste GeraEW × AbacatePay',
    expiresIn: 3600,
    metadata: {
      source: 'test-script',
      ranAt: new Date().toISOString(),
    },
  };
  return VERSION === 'v2' ? { method: 'PIX', data: payload } : payload;
}

async function main() {
  console.log(`\n🥑 AbacatePay — teste de PIX (${isDevKey ? 'SANDBOX' : 'PRODUÇÃO'})`);
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   API Key:  ${API_KEY.slice(0, 10)}…${API_KEY.slice(-4)}`);
  console.log(`   Versão:   ${VERSION}`);
  console.log(`   Valor:    R$ ${(amountCents / 100).toFixed(2)} (${amountCents} centavos)`);

  console.log('\n→ Criando PIX QR Code…');
  const create = await call<PixResponse>('POST', PATHS.create, buildCreateBody());
  const pix = create.data;
  console.log(`✅ PIX criado: ${pix.id}`);
  console.log(`   Status:    ${pix.status}`);
  console.log(`   devMode:   ${pix.devMode}`);
  console.log(`   Expira em: ${pix.expiresAt}`);
  console.log(`   Taxa:      R$ ${(pix.platformFee / 100).toFixed(2)}`);

  const base64 = pix.brCodeBase64.replace(/^data:image\/\w+;base64,/, '');
  const pngPath = path.resolve(__dirname, 'abacatepay-qr.png');
  fs.writeFileSync(pngPath, Buffer.from(base64, 'base64'));
  console.log(`   QR PNG:    ${pngPath}`);

  console.log('\n📋 PIX copia-e-cola:\n');
  console.log(pix.brCode);

  if (skipSimulate || !pix.devMode) {
    console.log(
      pix.devMode
        ? '\nℹ️  --no-simulate: pulando simulação. Você pode pagar manualmente para testar.'
        : '\nℹ️  Chave de produção: pague o QR no seu banco e rode o /check para conferir.',
    );
    return;
  }

  console.log('\n→ Simulando pagamento (sandbox)…');
  const sim = await call<PixResponse>(
    'POST',
    `${PATHS.simulate}?id=${encodeURIComponent(pix.id)}`,
    { metadata: { simulated: true } },
  );
  console.log(`✅ Simulação retornou status: ${sim.data.status}`);

  console.log('\n→ Verificando status pelo /check…');
  const check = await call<PixResponse>(
    'GET',
    `${PATHS.check}?id=${encodeURIComponent(pix.id)}`,
  );
  console.log(`✅ Status final: ${check.data.status}`);

  if (check.data.status === 'PAID') {
    console.log('\n🎉 Tudo funcionando: criação + simulação + check OK.');
  } else {
    console.log(`\n⚠️  Status inesperado: ${check.data.status}.`);
  }
}

main().catch((err) => {
  console.error('\n💥 Falhou:', err instanceof Error ? err.message : err);
  process.exit(1);
});
