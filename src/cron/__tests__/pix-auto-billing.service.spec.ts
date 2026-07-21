import { PixAutoBillingService } from '../pix-auto-billing.service';

/**
 * Monta o service com dependências mockadas direto pelo construtor — sem o
 * container do Nest, que nos specs deste projeto quebra por providers ausentes.
 */
function build(opts: {
  subscriptions: any[];
  existingPayment?: any;
  authStatus?: string;
  mode?: string;
  createChargeImpl?: jest.Mock;
}) {
  const prisma = {
    subscription: {
      findMany: jest.fn().mockResolvedValue(opts.subscriptions),
      update: jest.fn().mockResolvedValue({}),
    },
    payment: {
      findFirst: jest.fn().mockResolvedValue(opts.existingPayment ?? null),
      create: jest.fn().mockResolvedValue({}),
    },
  };

  const createRecurringCharge =
    opts.createChargeImpl ?? jest.fn().mockResolvedValue({ id: 'pay_novo' });

  const asaas = {
    createRecurringCharge,
    getAuthorization: jest
      .fn()
      .mockResolvedValue({ status: opts.authStatus ?? 'ACTIVE' }),
  };

  const cronLogger = { wrap: jest.fn((_o: any, fn: any) => fn()) };
  const config = { get: jest.fn().mockReturnValue(opts.mode) };

  const service = new PixAutoBillingService(
    prisma as any,
    asaas as any,
    cronLogger as any,
    config as any,
  );

  return { service, prisma, asaas, createRecurringCharge };
}

function makeSub(overrides: Partial<any> = {}) {
  return {
    id: 'sub_1',
    userId: 'user_1',
    currentPeriodStart: new Date('2026-06-20T02:39:00Z'),
    currentPeriodEnd: new Date('2026-07-20T02:39:00Z'),
    asaasAuthorizationId: 'auth_1',
    plan: { name: 'Starter', slug: 'starter', priceCents: 3990 },
    user: { email: 'cliente@exemplo.com', asaasCustomerId: 'cus_1' },
    ...overrides,
  };
}

describe('PixAutoBillingService', () => {
  describe('janela de cobrança', () => {
    it('cria a cobrança com vencimento em dia útil e antecedência dentro de 2-10 dias úteis', async () => {
      const { service, createRecurringCharge } = build({
        subscriptions: [makeSub()],
      });

      // 08/07 (quarta) → vencimento natural 20/07 (segunda): 7 dias úteis.
      const summary = await service.run(new Date('2026-07-08T06:00:00Z'));

      expect(summary.criadas).toBe(1);
      expect(createRecurringCharge).toHaveBeenCalledWith(
        expect.objectContaining({ dueDate: '2026-07-20', valueCents: 3990 }),
      );
    });

    it('empurra vencimento que cai em fim de semana para o próximo dia útil', async () => {
      const { service, createRecurringCharge } = build({
        // Período termina domingo 19/07.
        subscriptions: [
          makeSub({ currentPeriodEnd: new Date('2026-07-19T18:15:00Z') }),
        ],
      });

      await service.run(new Date('2026-07-08T06:00:00Z'));

      expect(createRecurringCharge).toHaveBeenCalledWith(
        expect.objectContaining({ dueDate: '2026-07-20' }),
      );
    });

    it('não cria nada quando ainda falta muito para o vencimento', async () => {
      const { service, createRecurringCharge } = build({
        subscriptions: [makeSub()],
      });

      // 01/07 → 20/07 são 13 dias úteis, acima do teto de 10.
      const summary = await service.run(new Date('2026-07-01T06:00:00Z'));

      expect(summary.criadas).toBe(0);
      expect(summary.puladas.muito_cedo).toBe(1);
      expect(createRecurringCharge).not.toHaveBeenCalled();
    });

    it('remarca para o próximo horizonte válido quando a janela ideal já passou', async () => {
      const { service, createRecurringCharge } = build({
        subscriptions: [makeSub()],
      });

      // 17/07: faltam 0 dias úteis para 20/07 — a regra do BACEN recusaria.
      // Em vez de perder o ciclo, remarca para 7 dias úteis à frente.
      const summary = await service.run(new Date('2026-07-17T06:00:00Z'));

      expect(summary.criadas).toBe(1);
      expect(createRecurringCharge).toHaveBeenCalledWith(
        expect.objectContaining({ dueDate: '2026-07-28' }),
      );
    });

    it('recupera ciclo já vencido — o caso dos clientes de junho', async () => {
      const { service, createRecurringCharge } = build({
        subscriptions: [
          makeSub({ currentPeriodEnd: new Date('2026-07-19T00:08:00Z') }),
        ],
      });

      const summary = await service.run(new Date('2026-07-21T06:00:00Z'));

      expect(summary.criadas).toBe(1);
      // 21/07 (terça) + 7 dias úteis = 30/07.
      expect(createRecurringCharge).toHaveBeenCalledWith(
        expect.objectContaining({ dueDate: '2026-07-30' }),
      );
    });
  });

  describe('idempotência', () => {
    it('não cobra duas vezes no mesmo ciclo', async () => {
      const { service, createRecurringCharge } = build({
        subscriptions: [makeSub()],
        existingPayment: { id: 'pay_ja_existe' },
      });

      const summary = await service.run(new Date('2026-07-08T06:00:00Z'));

      expect(summary.criadas).toBe(0);
      expect(summary.puladas.ja_cobrado_no_ciclo).toBe(1);
      expect(createRecurringCharge).not.toHaveBeenCalled();
    });
  });

  describe('sincronização de autorização', () => {
    it('não cobra e marca fim de período quando a autorização foi revogada no banco', async () => {
      const { service, prisma, createRecurringCharge } = build({
        subscriptions: [makeSub()],
        authStatus: 'CANCELED',
      });

      const summary = await service.run(new Date('2026-07-08T06:00:00Z'));

      expect(createRecurringCharge).not.toHaveBeenCalled();
      expect(summary.puladas.autorizacao_inativa).toBe(1);
      expect(summary.dessincronizadas).toEqual([
        {
          subscriptionId: 'sub_1',
          email: 'cliente@exemplo.com',
          statusAsaas: 'CANCELED',
        },
      ]);
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub_1' },
        data: { asaasAuthorizationStatus: 'CANCELED', cancelAtPeriodEnd: true },
      });
    });
  });

  describe('observabilidade', () => {
    it('persiste o motivo da falha no resumo em vez de só logar', async () => {
      const { service } = build({
        subscriptions: [makeSub()],
        createChargeImpl: jest
          .fn()
          .mockRejectedValue(new Error('Antecedência mínima não respeitada')),
      });

      const summary = await service.run(new Date('2026-07-08T06:00:00Z'));

      expect(summary.falhas).toBe(1);
      expect(summary.erros).toEqual([
        {
          subscriptionId: 'sub_1',
          email: 'cliente@exemplo.com',
          motivo: 'Antecedência mínima não respeitada',
        },
      ]);
    });

    it('uma falha não interrompe as demais assinaturas', async () => {
      const createChargeImpl = jest
        .fn()
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce({ id: 'pay_ok' });

      const { service } = build({
        subscriptions: [makeSub(), makeSub({ id: 'sub_2' })],
        createChargeImpl,
      });

      const summary = await service.run(new Date('2026-07-08T06:00:00Z'));

      expect(summary.falhas).toBe(1);
      expect(summary.criadas).toBe(1);
    });
  });

  describe('disparo manual (opções)', () => {
    it('respeita maxCharges — para de cobrar ao atingir o teto', async () => {
      const { service, createRecurringCharge } = build({
        subscriptions: [
          makeSub({ id: 'sub_1' }),
          makeSub({ id: 'sub_2' }),
          makeSub({ id: 'sub_3' }),
        ],
      });

      const summary = await service.run(new Date('2026-07-08T06:00:00Z'), {
        maxCharges: 1,
      });

      expect(summary.criadas).toBe(1);
      expect(createRecurringCharge).toHaveBeenCalledTimes(1);
    });

    it('dryRunOverride simula mesmo sem a env de dry_run', async () => {
      const { service, createRecurringCharge } = build({
        subscriptions: [makeSub()],
      });

      const summary = await service.run(new Date('2026-07-08T06:00:00Z'), {
        dryRunOverride: true,
      });

      expect(summary.modo).toBe('dry_run');
      expect(summary.simuladas).toBe(1);
      expect(summary.criadas).toBe(0);
      expect(createRecurringCharge).not.toHaveBeenCalled();
    });

    it('onlySubscriptionId restringe a busca a uma assinatura', async () => {
      const { service, prisma } = build({ subscriptions: [makeSub()] });

      await service.run(new Date('2026-07-08T06:00:00Z'), {
        onlySubscriptionId: 'sub_alvo',
      });

      expect(prisma.subscription.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'sub_alvo' }),
        }),
      );
    });
  });

  describe('modo dry run', () => {
    it('não chama o ASAAS e apenas contabiliza o que faria', async () => {
      const { service, createRecurringCharge } = build({
        subscriptions: [makeSub()],
        mode: 'dry_run',
      });

      const summary = await service.run(new Date('2026-07-08T06:00:00Z'));

      expect(summary.modo).toBe('dry_run');
      expect(summary.simuladas).toBe(1);
      expect(summary.criadas).toBe(0);
      expect(createRecurringCharge).not.toHaveBeenCalled();
    });
  });
});
