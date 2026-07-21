import {
  ASAAS_EXTERNAL_REFERENCE_MAX,
  decodeAsaasReference,
  encodeAsaasReference,
} from '../external-reference.util';

// cuids reais têm 25 caracteres — é o pior caso de tamanho.
const SUB_ID = 'cmqmulew404nbql01ji3xbo01';
const USER_ID = 'cmqmuile104luql01hwd46mhl';
const PKG_ID = 'cmqsf0j5g0lirql014nl3k11v';

describe('external-reference.util', () => {
  describe('limite de 100 caracteres do ASAAS', () => {
    it('assinatura cabe com folga', () => {
      const encoded = encodeAsaasReference({
        kind: 'subscription',
        subscriptionId: SUB_ID,
      });
      expect(encoded).toBe(`sub:${SUB_ID}`);
      expect(encoded.length).toBeLessThanOrEqual(ASAAS_EXTERNAL_REFERENCE_MAX);
    });

    it('boost com afiliado cabe — o formato JSON antigo dava 106 e era recusado', () => {
      const encoded = encodeAsaasReference({
        kind: 'boost',
        userId: USER_ID,
        packageId: PKG_ID,
        referredByCode: 'AFILIADO12345', // maior código existente: 13 chars
      });
      expect(encoded.length).toBeLessThanOrEqual(ASAAS_EXTERNAL_REFERENCE_MAX);

      const legacy = JSON.stringify({
        userId: USER_ID,
        packageId: PKG_ID,
        referredByCode: 'AFILIADO12345',
      });
      expect(legacy.length).toBeGreaterThan(ASAAS_EXTERNAL_REFERENCE_MAX);
    });

    it('falha alto se algum identificador crescer além do limite', () => {
      expect(() =>
        encodeAsaasReference({
          kind: 'subscription',
          subscriptionId: 'x'.repeat(120),
        }),
      ).toThrow(/excede o limite/);
    });
  });

  describe('ida e volta', () => {
    it('assinatura', () => {
      const ref = { kind: 'subscription' as const, subscriptionId: SUB_ID };
      expect(decodeAsaasReference(encodeAsaasReference(ref))).toEqual(ref);
    });

    it('boost sem afiliado', () => {
      const ref = {
        kind: 'boost' as const,
        userId: USER_ID,
        packageId: PKG_ID,
      };
      expect(decodeAsaasReference(encodeAsaasReference(ref))).toEqual(ref);
    });

    it('boost com afiliado', () => {
      const ref = {
        kind: 'boost' as const,
        userId: USER_ID,
        packageId: PKG_ID,
        referredByCode: 'ABC123',
      };
      expect(decodeAsaasReference(encodeAsaasReference(ref))).toEqual(ref);
    });
  });

  describe('compatibilidade com o formato JSON antigo', () => {
    it('decodifica boost legado — QR Codes pendentes ainda vão liquidar', () => {
      const legacy = JSON.stringify({
        userId: USER_ID,
        packageId: PKG_ID,
        referredByCode: 'ABC123',
      });
      expect(decodeAsaasReference(legacy)).toEqual({
        kind: 'boost',
        userId: USER_ID,
        packageId: PKG_ID,
        referredByCode: 'ABC123',
      });
    });

    it('decodifica assinatura legada', () => {
      const legacy = JSON.stringify({
        userId: USER_ID,
        planSlug: 'creator',
        subscriptionId: SUB_ID,
      });
      expect(decodeAsaasReference(legacy)).toEqual({
        kind: 'subscription',
        subscriptionId: SUB_ID,
      });
    });
  });

  describe('entradas inválidas', () => {
    it.each([
      ['nulo', null],
      ['vazio', ''],
      ['JSON quebrado', '{nao é json'],
      ['texto solto', 'pagamento avulso'],
      ['prefixo sem id', 'sub:'],
      ['boost sem userId', 'pkg:apenas-o-pacote'],
    ])('retorna null para %s', (_label, input) => {
      expect(decodeAsaasReference(input)).toBeNull();
    });
  });
});
