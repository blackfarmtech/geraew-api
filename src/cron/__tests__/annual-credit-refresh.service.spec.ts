import { AnnualCreditRefreshService } from '../annual-credit-refresh.service';

const plan = { name: 'Pro', slug: 'pro', creditsPerMonth: 30000 };

function makeSub(overrides: Partial<any> = {}) {
  return {
    id: 'sub_1',
    userId: 'user_1',
    status: 'ACTIVE',
    billingInterval: 'YEARLY',
    // Ano pago: 31/01/2026 → 31/01/2027 (horário local, meio-dia)
    currentPeriodStart: new Date(2026, 0, 31, 12),
    currentPeriodEnd: new Date(2027, 0, 31, 12),
    plan,
    user: {
      creditBalance: {
        userId: 'user_1',
        periodStart: new Date(2026, 0, 31, 12),
        periodEnd: new Date(2026, 1, 28, 12),
      },
    },
    ...overrides,
  };
}

function build(subscriptions: any[], updatedCount = 1) {
  const tx = {
    creditBalance: {
      updateMany: jest.fn().mockResolvedValue({ count: updatedCount }),
    },
    creditTransaction: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    subscription: { findMany: jest.fn().mockResolvedValue(subscriptions) },
    $transaction: jest.fn((fn: any) => fn(tx)),
  };
  const cronLogger = { wrap: jest.fn((_o: any, fn: any) => fn()) };
  const service = new AnnualCreditRefreshService(
    prisma as any,
    cronLogger as any,
  );
  return { service, prisma, tx, cronLogger };
}

describe('AnnualCreditRefreshService', () => {
  it('busca só anuais ativos, dentro do ano pago, com ciclo de créditos vencido', async () => {
    const { service, prisma } = build([]);
    const now = new Date(2026, 2, 1, 12);

    await service.run(now);

    expect(prisma.subscription.findMany).toHaveBeenCalledWith({
      where: {
        status: 'ACTIVE',
        billingInterval: 'YEARLY',
        currentPeriodEnd: { gt: now },
        OR: [{ pausedUntil: null }, { pausedUntil: { lte: now } }],
        user: { creditBalance: { is: { periodEnd: { lte: now } } } },
      },
      include: { plan: true, user: { select: { creditBalance: true } } },
    });
  });

  it('renova os créditos do mês seguinte (ancorado no início do ano pago)', async () => {
    const { service, tx } = build([makeSub()]);

    // 28/02 venceu o 1º ciclo; agora é 01/03
    const summary = await service.run(new Date(2026, 2, 1, 12));

    expect(summary).toEqual(
      expect.objectContaining({
        candidatos: 1,
        renovadas: 1,
        puladas: 0,
        falhas: 0,
      }),
    );
    expect(tx.creditBalance.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user_1', periodEnd: new Date(2026, 1, 28, 12) },
      data: {
        planCreditsRemaining: 30000,
        planCreditsUsed: 0,
        periodStart: new Date(2026, 1, 28, 12),
        // dia 31 volta a valer em março (não escorrega para 28)
        periodEnd: new Date(2026, 2, 31, 12),
      },
    });
    expect(tx.creditTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user_1',
        type: 'SUBSCRIPTION_RENEWAL',
        amount: 30000,
        source: 'plan',
        description: 'Créditos mensais — plano anual Pro',
      }),
    });
  });

  it('cron parado por meses: um único reset, no ciclo que contém "agora"', async () => {
    const { service, tx } = build([makeSub()]);

    await service.run(new Date(2026, 5, 15, 12)); // 15/06

    expect(tx.creditBalance.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.creditBalance.updateMany.mock.calls[0][0].data).toEqual(
      expect.objectContaining({
        periodStart: new Date(2026, 4, 31, 12),
        periodEnd: new Date(2026, 5, 30, 12),
      }),
    );
    expect(tx.creditTransaction.create).toHaveBeenCalledTimes(1);
  });

  it('último mês do ano: o ciclo termina junto com o período pago', async () => {
    const sub = makeSub({
      user: {
        creditBalance: {
          userId: 'user_1',
          periodStart: new Date(2026, 10, 30, 12),
          periodEnd: new Date(2026, 11, 31, 12),
        },
      },
    });
    const { service, tx } = build([sub]);

    await service.run(new Date(2027, 0, 2, 12));

    expect(tx.creditBalance.updateMany.mock.calls[0][0].data).toEqual(
      expect.objectContaining({
        periodStart: new Date(2026, 11, 31, 12),
        periodEnd: new Date(2027, 0, 31, 12), // = currentPeriodEnd
      }),
    );
  });

  it('não credita quando o ano pago já acabou (a renovação paga é quem reseta)', async () => {
    // Mesmo que a query devolvesse, o ciclo é calculado como inexistente.
    const { service, tx } = build([makeSub()]);

    const summary = await service.run(new Date(2027, 0, 31, 12));

    expect(summary.renovadas).toBe(0);
    expect(summary.puladas).toBe(1);
    expect(tx.creditBalance.updateMany).not.toHaveBeenCalled();
  });

  it('idempotente: se outra execução já renovou, não cria transação', async () => {
    const { service, tx } = build([makeSub()], 0);

    const summary = await service.run(new Date(2026, 2, 1, 12));

    expect(summary.renovadas).toBe(0);
    expect(summary.puladas).toBe(1);
    expect(tx.creditTransaction.create).not.toHaveBeenCalled();
  });

  it('pula assinatura sem saldo de créditos ou plano sem créditos mensais', async () => {
    const { service, tx } = build([
      makeSub({ user: { creditBalance: null } }),
      makeSub({ id: 'sub_2', plan: { ...plan, creditsPerMonth: 0 } }),
    ]);

    const summary = await service.run(new Date(2026, 2, 1, 12));

    expect(summary.puladas).toBe(2);
    expect(tx.creditBalance.updateMany).not.toHaveBeenCalled();
  });

  it('erro numa assinatura não interrompe as outras', async () => {
    const { service, prisma } = build([
      makeSub(),
      makeSub({ id: 'sub_2', userId: 'user_2' }),
    ]);
    prisma.$transaction
      .mockImplementationOnce(() => Promise.reject(new Error('db caiu')))
      .mockImplementationOnce((fn: any) =>
        fn({
          creditBalance: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          creditTransaction: { create: jest.fn() },
        }),
      );

    const summary = await service.run(new Date(2026, 2, 1, 12));

    expect(summary.falhas).toBe(1);
    expect(summary.renovadas).toBe(1);
  });

  it('o handler agendado passa pelo CronLoggerService', async () => {
    const { service, cronLogger } = build([]);

    await service.handleAnnualCreditRefresh();

    expect(cronLogger.wrap).toHaveBeenCalledWith(
      expect.objectContaining({
        cronName: 'AnnualCreditRefreshService.handleAnnualCreditRefresh',
        schedule: '15 * * * *',
      }),
      expect.any(Function),
    );
  });
});
