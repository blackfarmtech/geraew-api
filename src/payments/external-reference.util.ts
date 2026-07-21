/**
 * Codificação do campo `externalReference` das cobranças no ASAAS.
 *
 * O ASAAS impõe um limite rígido de 100 caracteres e responde
 * `400 invalid_externalReference` quando estourado. O formato JSON usado antes
 * passava desse limite em dois fluxos, e ambos falhavam silenciosamente:
 *
 * - renovação de assinatura `{userId, planSlug, subscriptionId}` → 104 chars,
 *   o que derrubou 100% das cobranças recorrentes de PIX Automático;
 * - boost com afiliado `{userId, packageId, referredByCode}` → 106 chars,
 *   o que impedia qualquer usuário indicado de comprar créditos via PIX.
 *
 * O formato compacto abaixo é posicional, legível no painel do ASAAS e cabe
 * folgado: 29 chars para assinatura e no máximo ~69 para boost.
 */

export const ASAAS_EXTERNAL_REFERENCE_MAX = 100;

const SUBSCRIPTION_PREFIX = 'sub';
const BOOST_PREFIX = 'pkg';

export type AsaasReference =
  | { kind: 'subscription'; subscriptionId: string }
  | { kind: 'boost'; userId: string; packageId: string; referredByCode?: string };

/**
 * Serializa a referência no formato compacto.
 *
 * @throws se o resultado ultrapassar o limite do ASAAS. Pelos tamanhos de cuid
 * e de código de afiliado isso não acontece na prática — é uma trava para
 * falhar alto caso algum identificador cresça, em vez de repetir o bug antigo.
 */
export function encodeAsaasReference(ref: AsaasReference): string {
  const encoded =
    ref.kind === 'subscription'
      ? `${SUBSCRIPTION_PREFIX}:${ref.subscriptionId}`
      : [BOOST_PREFIX, ref.packageId, ref.userId, ref.referredByCode]
          .filter((part): part is string => Boolean(part))
          .join(':');

  if (encoded.length > ASAAS_EXTERNAL_REFERENCE_MAX) {
    throw new Error(
      `externalReference com ${encoded.length} caracteres excede o limite de ` +
        `${ASAAS_EXTERNAL_REFERENCE_MAX} do ASAAS: ${encoded}`,
    );
  }

  return encoded;
}

/**
 * Interpreta o `externalReference` devolvido pelo ASAAS.
 *
 * Aceita também o formato JSON antigo: cobranças de boost criadas antes desta
 * mudança podem estar com QR Code pendente e ainda vão liquidar.
 */
export function decodeAsaasReference(
  raw: string | null | undefined,
): AsaasReference | null {
  if (!raw) return null;

  const trimmed = raw.trim();

  if (trimmed.startsWith(`${SUBSCRIPTION_PREFIX}:`)) {
    const subscriptionId = trimmed.slice(SUBSCRIPTION_PREFIX.length + 1);
    return subscriptionId ? { kind: 'subscription', subscriptionId } : null;
  }

  if (trimmed.startsWith(`${BOOST_PREFIX}:`)) {
    const [, packageId, userId, referredByCode] = trimmed.split(':');
    if (!packageId || !userId) return null;
    return {
      kind: 'boost',
      packageId,
      userId,
      ...(referredByCode ? { referredByCode } : {}),
    };
  }

  return decodeLegacyJson(trimmed);
}

function decodeLegacyJson(raw: string): AsaasReference | null {
  if (!raw.startsWith('{')) return null;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }

  const str = (v: unknown): string | undefined =>
    typeof v === 'string' && v.length > 0 ? v : undefined;

  const subscriptionId = str(parsed.subscriptionId);
  if (subscriptionId) return { kind: 'subscription', subscriptionId };

  const packageId = str(parsed.packageId);
  const userId = str(parsed.userId);
  if (packageId && userId) {
    const referredByCode = str(parsed.referredByCode);
    return {
      kind: 'boost',
      packageId,
      userId,
      ...(referredByCode ? { referredByCode } : {}),
    };
  }

  return null;
}
