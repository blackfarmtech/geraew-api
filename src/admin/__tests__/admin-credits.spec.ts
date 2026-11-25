import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from '../admin.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ModelsService } from '../../models/models.service';
import { UploadsService } from '../../uploads/uploads.service';

type Row = { plan_credits_remaining: number; bonus_credits_remaining: number };

/** Prisma falso: o $transaction entrega um tx que lê `row` travando a linha. */
function prismaWith(row: Row | null, userExists = true) {
  const tx = {
    $queryRaw: jest.fn((strings: TemplateStringsArray) => {
      tx.lastSql = strings.join('?');
      return Promise.resolve(row ? [row] : []);
    }),
    lastSql: '',
    creditBalance: { create: jest.fn(), update: jest.fn() },
    creditTransaction: { create: jest.fn() },
  };
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(userExists ? { id: 'user-1' } : null),
    },
    $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  return { prisma, tx };
}

async function build(row: Row | null, userExists = true) {
  const { prisma, tx } = prismaWith(row, userExists);
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      AdminService,
      { provide: PrismaService, useValue: prisma },
      // dependências que estes métodos não usam
      { provide: ModelsService, useValue: {} },
      { provide: UploadsService, useValue: {} },
    ],
  }).compile();
  return { service: module.get(AdminService), prisma, tx };
}

const balance = (plan: number, bonus: number): Row => ({
  plan_credits_remaining: plan,
  bonus_credits_remaining: bonus,
});

describe('AdminService: ajuste e zerar créditos', () => {
  describe('adjustCredits', () => {
    it('sem source mexe no bônus, como antes', async () => {
      const { service, tx } = await build(balance(3150, 110));

      const result = await service.adjustCredits('user-1', 100, 'Compensação');

      expect(tx.creditBalance.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { planCreditsRemaining: 3150, bonusCreditsRemaining: 210 },
      });
      expect(tx.creditTransaction.create.mock.calls[0][0].data).toMatchObject({
        amount: 100,
        source: 'bonus',
        type: 'ADMIN_ADJUSTMENT',
      });
      expect(result).toEqual({
        planCreditsRemaining: 3150,
        bonusCreditsRemaining: 210,
        applied: 100,
      });
    });

    it('source plan tira da franquia do plano e deixa o bônus', async () => {
      const { service, tx } = await build(balance(3150, 110));

      const result = await service.adjustCredits(
        'user-1',
        -1000,
        'Ajuste',
        'plan',
        'admin@geraew.ai',
      );

      expect(tx.creditBalance.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { planCreditsRemaining: 2150, bonusCreditsRemaining: 110 },
      });
      expect(tx.creditTransaction.create.mock.calls[0][0].data).toMatchObject({
        amount: -1000,
        source: 'plan',
        metadata: { requestedAmount: -1000, adminEmail: 'admin@geraew.ai' },
      });
      expect(result.applied).toBe(-1000);
    });

    it('remover mais do que existe para em zero e grava só o que saiu', async () => {
      const { service, tx } = await build(balance(0, 300));

      const result = await service.adjustCredits('user-1', -500, 'Ajuste');

      expect(tx.creditBalance.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { planCreditsRemaining: 0, bonusCreditsRemaining: 0 },
      });
      expect(tx.creditTransaction.create.mock.calls[0][0].data).toMatchObject({
        amount: -300,
        metadata: { requestedAmount: -500 },
      });
      expect(result.applied).toBe(-300);
    });

    it('nada a remover: não escreve saldo nem histórico', async () => {
      const { service, tx } = await build(balance(0, 0));

      const result = await service.adjustCredits('user-1', -50, 'Ajuste', 'plan');

      expect(tx.creditBalance.update).not.toHaveBeenCalled();
      expect(tx.creditTransaction.create).not.toHaveBeenCalled();
      expect(result.applied).toBe(0);
    });

    it('trava a linha de saldo antes de calcular', async () => {
      const { service, tx } = await build(balance(10, 10));

      await service.adjustCredits('user-1', 5, 'Ajuste');

      expect(tx.lastSql).toMatch(/FOR UPDATE/);
    });

    it('sem linha de saldo, cria zerada e aplica o ajuste', async () => {
      const { service, tx } = await build(null);

      const result = await service.adjustCredits('user-1', 100, 'Boas-vindas');

      expect(tx.creditBalance.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          planCreditsRemaining: 0,
          bonusCreditsRemaining: 0,
          planCreditsUsed: 0,
        },
      });
      expect(result.bonusCreditsRemaining).toBe(100);
    });

    it('usuário inexistente: 404 sem abrir transação', async () => {
      const { service, prisma } = await build(balance(0, 0), false);

      await expect(service.adjustCredits('x', 10, 'Ajuste')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('zeroCredits', () => {
    it('zera plano e bônus e grava as duas saídas', async () => {
      const { service, tx } = await build(balance(3150, 110));

      const result = await service.zeroCredits(
        'user-1',
        'Plano obtido por falha no cupom de upgrade',
        'admin@geraew.ai',
      );

      expect(tx.creditBalance.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { planCreditsRemaining: 0, bonusCreditsRemaining: 0 },
      });
      const entries = tx.creditTransaction.create.mock.calls.map((c) => c[0].data);
      expect(entries).toEqual([
        expect.objectContaining({ amount: -3150, source: 'plan' }),
        expect.objectContaining({ amount: -110, source: 'bonus' }),
      ]);
      expect(entries[0].metadata).toEqual({
        zeroed: true,
        adminEmail: 'admin@geraew.ai',
      });
      expect(result).toEqual({
        planCreditsRemaining: 0,
        bonusCreditsRemaining: 0,
        planRemoved: 3150,
        bonusRemoved: 110,
      });
      expect(tx.lastSql).toMatch(/FOR UPDATE/);
    });

    it('só bônus: grava uma saída só', async () => {
      const { service, tx } = await build(balance(0, 340));

      await service.zeroCredits('user-1', 'Ajuste');

      expect(tx.creditTransaction.create).toHaveBeenCalledTimes(1);
      expect(tx.creditTransaction.create.mock.calls[0][0].data).toMatchObject({
        amount: -340,
        source: 'bonus',
      });
    });

    it('saldo já zerado: não escreve nada', async () => {
      const { service, tx } = await build(balance(0, 0));

      const result = await service.zeroCredits('user-1', 'Ajuste');

      expect(tx.creditBalance.update).not.toHaveBeenCalled();
      expect(tx.creditTransaction.create).not.toHaveBeenCalled();
      expect(result.planRemoved + result.bonusRemoved).toBe(0);
    });
  });
});
