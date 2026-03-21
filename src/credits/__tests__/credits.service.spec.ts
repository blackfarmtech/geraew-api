import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CreditsService } from '../credits.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PlansService } from '../../plans/plans.service';

// ── Fixtures ─────────────────────────────────────────────────────────

const mockCreditBalance = {
  userId: 'user-1',
  planCreditsRemaining: 800,
  bonusCreditsRemaining: 200,
  planCreditsUsed: 200,
  periodStart: new Date('2026-03-01'),
  periodEnd: new Date('2026-04-01'),
};

// ── Mocks ────────────────────────────────────────────────────────────

const createMockTx = () => ({
  creditBalance: {
    findUnique: jest.fn().mockResolvedValue({ ...mockCreditBalance }),
    update: jest.fn().mockResolvedValue({ ...mockCreditBalance }),
  },
  creditTransaction: {
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 'ct-1' }),
  },
});

const createMockPrisma = () => {
  const tx = createMockTx();

  return {
    creditBalance: {
      findUnique: jest.fn().mockResolvedValue({ ...mockCreditBalance }),
    },
    creditTransaction: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    $transaction: jest.fn((fn) => fn(tx)),
    __tx: tx,
  };
};

const createMockPlansService = () => ({
  findAllPackages: jest.fn().mockResolvedValue([]),
  calculateGenerationCost: jest.fn().mockResolvedValue(10),
});

let mockPrisma: ReturnType<typeof createMockPrisma>;
let mockPlansService: ReturnType<typeof createMockPlansService>;

// ── Test Suite ───────────────────────────────────────────────────────

describe('CreditsService', () => {
  let service: CreditsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma = createMockPrisma();
    mockPlansService = createMockPlansService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreditsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PlansService, useValue: mockPlansService },
      ],
    }).compile();

    service = module.get<CreditsService>(CreditsService);
  });

  // ══════════════════════════════════════════════════════════════════
  // getBalance
  // ══════════════════════════════════════════════════════════════════

  describe('getBalance', () => {
    it('deve retornar saldo correto para usuário existente', async () => {
      const result = await service.getBalance('user-1');

      expect(result).toEqual({
        planCreditsRemaining: 800,
        bonusCreditsRemaining: 200,
        totalCreditsAvailable: 1000,
        planCreditsUsed: 200,
        periodStart: mockCreditBalance.periodStart,
        periodEnd: mockCreditBalance.periodEnd,
      });
      expect(mockPrisma.creditBalance.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
    });

    it('deve retornar zeros quando usuário não tem saldo', async () => {
      mockPrisma.creditBalance.findUnique.mockResolvedValue(null);

      const result = await service.getBalance('user-sem-saldo');

      expect(result).toEqual({
        planCreditsRemaining: 0,
        bonusCreditsRemaining: 0,
        totalCreditsAvailable: 0,
        planCreditsUsed: 0,
        periodStart: null,
        periodEnd: null,
      });
    });

    it('totalCreditsAvailable deve ser planCreditsRemaining + bonusCreditsRemaining', async () => {
      mockPrisma.creditBalance.findUnique.mockResolvedValue({
        ...mockCreditBalance,
        planCreditsRemaining: 350,
        bonusCreditsRemaining: 150,
      });

      const result = await service.getBalance('user-1');

      expect(result.totalCreditsAvailable).toBe(500);
      expect(result.totalCreditsAvailable).toBe(
        result.planCreditsRemaining + result.bonusCreditsRemaining,
      );
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // getTransactions
  // ══════════════════════════════════════════════════════════════════

  describe('getTransactions', () => {
    it('deve retornar transações paginadas', async () => {
      const mockTx = {
        id: 'tx-1',
        type: 'GENERATION_DEBIT',
        amount: -10,
        source: 'plan',
        description: 'Débito',
        generationId: 'gen-1',
        paymentId: null,
        createdAt: new Date('2026-03-15'),
      };
      mockPrisma.creditTransaction.findMany.mockResolvedValue([mockTx]);
      mockPrisma.creditTransaction.count.mockResolvedValue(1);

      const pagination = { page: 1, limit: 20, skip: 0 } as any;
      const result = await service.getTransactions('user-1', pagination);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('tx-1');
      expect(result.meta.total).toBe(1);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // getPackages
  // ══════════════════════════════════════════════════════════════════

  describe('getPackages', () => {
    it('deve delegar para plansService.findAllPackages', async () => {
      const packages = [{ id: 'pkg-1', name: 'Pacote 500', credits: 500 }];
      mockPlansService.findAllPackages.mockResolvedValue(packages);

      const result = await service.getPackages();

      expect(result).toEqual(packages);
      expect(mockPlansService.findAllPackages).toHaveBeenCalled();
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // estimateCost
  // ══════════════════════════════════════════════════════════════════

  describe('estimateCost', () => {
    it('deve retornar custo correto e hasSufficientBalance=true quando há saldo', async () => {
      mockPlansService.calculateGenerationCost.mockResolvedValue(50);

      const result = await service.estimateCost(
        'user-1',
        'TEXT_TO_IMAGE' as any,
        '_1K' as any,
      );

      expect(result).toEqual({
        creditsRequired: 50,
        hasSufficientBalance: true,
      });
      expect(mockPlansService.calculateGenerationCost).toHaveBeenCalledWith(
        'TEXT_TO_IMAGE',
        '_1K',
        undefined,
        false,
        1,
      );
    });

    it('deve retornar hasSufficientBalance=false quando saldo insuficiente', async () => {
      mockPlansService.calculateGenerationCost.mockResolvedValue(2000);

      const result = await service.estimateCost(
        'user-1',
        'TEXT_TO_VIDEO' as any,
        '_1080P' as any,
        10,
        true,
      );

      expect(result).toEqual({
        creditsRequired: 2000,
        hasSufficientBalance: false,
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // debit
  // ══════════════════════════════════════════════════════════════════

  describe('debit', () => {
    it('deve debitar totalmente dos créditos do plano quando suficientes', async () => {
      const tx = mockPrisma.__tx;
      tx.creditBalance.findUnique.mockResolvedValue({
        ...mockCreditBalance,
        planCreditsRemaining: 500,
        bonusCreditsRemaining: 200,
        planCreditsUsed: 100,
      });

      await service.debit('user-1', 100, 'GENERATION_DEBIT' as any, 'gen-1');

      expect(tx.creditBalance.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: {
          planCreditsRemaining: 400,
          bonusCreditsRemaining: 200,
          planCreditsUsed: 200,
        },
      });

      // Apenas uma transação de crédito (plan)
      expect(tx.creditTransaction.create).toHaveBeenCalledTimes(1);
      expect(tx.creditTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          type: 'GENERATION_DEBIT',
          amount: -100,
          source: 'plan',
          generationId: 'gen-1',
        }),
      });
    });

    it('deve debitar do plano primeiro e transbordar para bônus', async () => {
      const tx = mockPrisma.__tx;
      tx.creditBalance.findUnique.mockResolvedValue({
        ...mockCreditBalance,
        planCreditsRemaining: 30,
        bonusCreditsRemaining: 200,
        planCreditsUsed: 70,
      });

      await service.debit('user-1', 50, 'GENERATION_DEBIT' as any, 'gen-2');

      expect(tx.creditBalance.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: {
          planCreditsRemaining: 0,
          bonusCreditsRemaining: 180,
          planCreditsUsed: 100,
        },
      });

      // Duas transações: plan (30) + bonus (20)
      expect(tx.creditTransaction.create).toHaveBeenCalledTimes(2);
      expect(tx.creditTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          amount: -30,
          source: 'plan',
        }),
      });
      expect(tx.creditTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          amount: -20,
          source: 'bonus',
        }),
      });
    });

    it('deve debitar totalmente do bônus quando créditos do plano são 0', async () => {
      const tx = mockPrisma.__tx;
      tx.creditBalance.findUnique.mockResolvedValue({
        ...mockCreditBalance,
        planCreditsRemaining: 0,
        bonusCreditsRemaining: 500,
        planCreditsUsed: 1000,
      });

      await service.debit('user-1', 100, 'GENERATION_DEBIT' as any, 'gen-3');

      expect(tx.creditBalance.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: {
          planCreditsRemaining: 0,
          bonusCreditsRemaining: 400,
          planCreditsUsed: 1000,
        },
      });

      // Apenas transação de bônus
      expect(tx.creditTransaction.create).toHaveBeenCalledTimes(1);
      expect(tx.creditTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          amount: -100,
          source: 'bonus',
        }),
      });
    });

    it('deve lançar INSUFFICIENT_CREDITS quando total < amount', async () => {
      const tx = mockPrisma.__tx;
      tx.creditBalance.findUnique.mockResolvedValue({
        ...mockCreditBalance,
        planCreditsRemaining: 10,
        bonusCreditsRemaining: 5,
      });

      await expect(
        service.debit('user-1', 100, 'GENERATION_DEBIT' as any),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.debit('user-1', 100, 'GENERATION_DEBIT' as any),
      ).rejects.toThrow(/Créditos insuficientes/);
    });

    it('deve lançar NotFoundException quando saldo não existe', async () => {
      const tx = mockPrisma.__tx;
      tx.creditBalance.findUnique.mockResolvedValue(null);

      await expect(
        service.debit('user-sem-saldo', 10, 'GENERATION_DEBIT' as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('deve criar registros separados de credit_transaction para débitos plan e bonus', async () => {
      const tx = mockPrisma.__tx;
      tx.creditBalance.findUnique.mockResolvedValue({
        ...mockCreditBalance,
        planCreditsRemaining: 60,
        bonusCreditsRemaining: 100,
        planCreditsUsed: 40,
      });

      await service.debit(
        'user-1',
        80,
        'GENERATION_DEBIT' as any,
        'gen-4',
        'Geração de imagem',
      );

      expect(tx.creditTransaction.create).toHaveBeenCalledTimes(2);

      const calls = tx.creditTransaction.create.mock.calls;
      const planCall = calls.find((c: any) => c[0].data.source === 'plan');
      const bonusCall = calls.find((c: any) => c[0].data.source === 'bonus');

      expect(planCall[0].data).toEqual(
        expect.objectContaining({
          userId: 'user-1',
          type: 'GENERATION_DEBIT',
          amount: -60,
          source: 'plan',
          generationId: 'gen-4',
          description: 'Geração de imagem',
        }),
      );
      expect(bonusCall[0].data).toEqual(
        expect.objectContaining({
          userId: 'user-1',
          type: 'GENERATION_DEBIT',
          amount: -20,
          source: 'bonus',
          generationId: 'gen-4',
          description: 'Geração de imagem',
        }),
      );
    });

    it('deve incrementar planCreditsUsed corretamente', async () => {
      const tx = mockPrisma.__tx;
      tx.creditBalance.findUnique.mockResolvedValue({
        ...mockCreditBalance,
        planCreditsRemaining: 300,
        bonusCreditsRemaining: 100,
        planCreditsUsed: 700,
      });

      await service.debit('user-1', 50, 'GENERATION_DEBIT' as any);

      expect(tx.creditBalance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            planCreditsUsed: 750,
          }),
        }),
      );
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // refund
  // ══════════════════════════════════════════════════════════════════

  describe('refund', () => {
    it('deve estornar para as fontes originais (plan->plan, bonus->bonus)', async () => {
      const tx = mockPrisma.__tx;
      tx.creditTransaction.findMany.mockResolvedValue([
        { id: 'dt-1', amount: -60, source: 'plan', type: 'GENERATION_DEBIT' },
        { id: 'dt-2', amount: -40, source: 'bonus', type: 'GENERATION_DEBIT' },
      ]);
      tx.creditBalance.findUnique.mockResolvedValue({
        ...mockCreditBalance,
        planCreditsRemaining: 740,
        bonusCreditsRemaining: 160,
        planCreditsUsed: 260,
      });

      await service.refund('user-1', 100, 'gen-1');

      expect(tx.creditBalance.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: {
          planCreditsRemaining: 800,
          bonusCreditsRemaining: 200,
          planCreditsUsed: 200,
        },
      });

      expect(tx.creditTransaction.create).toHaveBeenCalledTimes(2);
      expect(tx.creditTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'GENERATION_REFUND',
          amount: 60,
          source: 'plan',
          generationId: 'gen-1',
        }),
      });
      expect(tx.creditTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'GENERATION_REFUND',
          amount: 40,
          source: 'bonus',
          generationId: 'gen-1',
        }),
      });
    });

    it('deve estornar para bônus quando não há registros de débito', async () => {
      const tx = mockPrisma.__tx;
      tx.creditTransaction.findMany.mockResolvedValue([]);
      tx.creditBalance.findUnique.mockResolvedValue({
        ...mockCreditBalance,
        planCreditsRemaining: 800,
        bonusCreditsRemaining: 100,
        planCreditsUsed: 200,
      });

      await service.refund('user-1', 50, 'gen-orphan');

      expect(tx.creditBalance.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: {
          planCreditsRemaining: 800,
          bonusCreditsRemaining: 150,
          planCreditsUsed: 200,
        },
      });

      expect(tx.creditTransaction.create).toHaveBeenCalledTimes(1);
      expect(tx.creditTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'GENERATION_REFUND',
          amount: 50,
          source: 'bonus',
        }),
      });
    });

    it('deve estornar tudo para plano quando só há débitos de plano', async () => {
      const tx = mockPrisma.__tx;
      tx.creditTransaction.findMany.mockResolvedValue([
        { id: 'dt-1', amount: -100, source: 'plan', type: 'GENERATION_DEBIT' },
      ]);
      tx.creditBalance.findUnique.mockResolvedValue({
        ...mockCreditBalance,
        planCreditsRemaining: 700,
        bonusCreditsRemaining: 200,
        planCreditsUsed: 300,
      });

      await service.refund('user-1', 100, 'gen-plan-only');

      expect(tx.creditBalance.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: {
          planCreditsRemaining: 800,
          bonusCreditsRemaining: 200,
          planCreditsUsed: 200,
        },
      });

      expect(tx.creditTransaction.create).toHaveBeenCalledTimes(1);
      expect(tx.creditTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          amount: 100,
          source: 'plan',
        }),
      });
    });

    it('deve distribuir estorno corretamente com fontes mistas', async () => {
      const tx = mockPrisma.__tx;
      tx.creditTransaction.findMany.mockResolvedValue([
        { id: 'dt-1', amount: -70, source: 'plan', type: 'GENERATION_DEBIT' },
        { id: 'dt-2', amount: -30, source: 'bonus', type: 'GENERATION_DEBIT' },
      ]);
      tx.creditBalance.findUnique.mockResolvedValue({
        ...mockCreditBalance,
        planCreditsRemaining: 730,
        bonusCreditsRemaining: 170,
        planCreditsUsed: 270,
      });

      await service.refund('user-1', 100, 'gen-mixed');

      // planRefund = 70, bonusRefund = 30 (baseado nos débitos originais)
      expect(tx.creditBalance.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: {
          planCreditsRemaining: 800,
          bonusCreditsRemaining: 200,
          planCreditsUsed: 200,
        },
      });
    });

    it('deve lançar NotFoundException quando saldo não existe', async () => {
      const tx = mockPrisma.__tx;
      tx.creditTransaction.findMany.mockResolvedValue([]);
      tx.creditBalance.findUnique.mockResolvedValue(null);

      await expect(
        service.refund('user-sem-saldo', 50, 'gen-x'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // partialRefund
  // ══════════════════════════════════════════════════════════════════

  describe('partialRefund', () => {
    it('deve distribuir estorno parcial proporcionalmente', async () => {
      const tx = mockPrisma.__tx;
      // Débito original: 80 plan + 20 bonus = 100 total
      tx.creditTransaction.findMany.mockResolvedValue([
        { id: 'dt-1', amount: -80, source: 'plan', type: 'GENERATION_DEBIT' },
        { id: 'dt-2', amount: -20, source: 'bonus', type: 'GENERATION_DEBIT' },
      ]);
      tx.creditBalance.findUnique.mockResolvedValue({
        ...mockCreditBalance,
        planCreditsRemaining: 720,
        bonusCreditsRemaining: 180,
        planCreditsUsed: 280,
      });

      // Estorno parcial de 50 (metade)
      await service.partialRefund('user-1', 50, 'gen-partial');

      // planRefund = Math.round(80/100 * 50) = 40
      // bonusRefund = 50 - 40 = 10
      expect(tx.creditBalance.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: {
          planCreditsRemaining: 760,
          bonusCreditsRemaining: 190,
          planCreditsUsed: 240,
        },
      });

      expect(tx.creditTransaction.create).toHaveBeenCalledTimes(2);
      expect(tx.creditTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'GENERATION_REFUND',
          amount: 40,
          source: 'plan',
        }),
      });
      expect(tx.creditTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'GENERATION_REFUND',
          amount: 10,
          source: 'bonus',
        }),
      });
    });

    it('estorno parcial nunca deve exceder o débito original por fonte', async () => {
      const tx = mockPrisma.__tx;
      // Débito original: 10 plan + 90 bonus = 100 total
      tx.creditTransaction.findMany.mockResolvedValue([
        { id: 'dt-1', amount: -10, source: 'plan', type: 'GENERATION_DEBIT' },
        { id: 'dt-2', amount: -90, source: 'bonus', type: 'GENERATION_DEBIT' },
      ]);
      tx.creditBalance.findUnique.mockResolvedValue({
        ...mockCreditBalance,
        planCreditsRemaining: 790,
        bonusCreditsRemaining: 110,
        planCreditsUsed: 210,
      });

      // Estorno de 80
      // planRefund = Math.round(10/100 * 80) = 8
      // bonusRefund = 80 - 8 = 72
      // 8 <= 10 (ok), 72 <= 90 (ok) — nenhum excede
      await service.partialRefund('user-1', 80, 'gen-cap');

      const updateCall = tx.creditBalance.update.mock.calls[0][0];
      const planRefund = updateCall.data.planCreditsRemaining - 790;
      const bonusRefund = updateCall.data.bonusCreditsRemaining - 110;

      expect(planRefund).toBeLessThanOrEqual(10);
      expect(bonusRefund).toBeLessThanOrEqual(90);
      expect(planRefund + bonusRefund).toBe(80);
    });

    it('deve ser no-op quando refundAmount é 0', async () => {
      await service.partialRefund('user-1', 0, 'gen-zero');

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('deve estornar para bônus quando não há registros de débito', async () => {
      const tx = mockPrisma.__tx;
      tx.creditTransaction.findMany.mockResolvedValue([]);
      tx.creditBalance.findUnique.mockResolvedValue({
        ...mockCreditBalance,
        planCreditsRemaining: 800,
        bonusCreditsRemaining: 200,
        planCreditsUsed: 200,
      });

      await service.partialRefund('user-1', 30, 'gen-no-debits');

      expect(tx.creditBalance.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: {
          planCreditsRemaining: 800,
          bonusCreditsRemaining: 230,
          planCreditsUsed: 200,
        },
      });

      expect(tx.creditTransaction.create).toHaveBeenCalledTimes(1);
      expect(tx.creditTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'GENERATION_REFUND',
          amount: 30,
          source: 'bonus',
        }),
      });
    });

    it('deve usar descrição customizada quando fornecida', async () => {
      const tx = mockPrisma.__tx;
      tx.creditTransaction.findMany.mockResolvedValue([]);
      tx.creditBalance.findUnique.mockResolvedValue({
        ...mockCreditBalance,
      });

      await service.partialRefund(
        'user-1',
        25,
        'gen-desc',
        'Estorno por erro de processamento',
      );

      expect(tx.creditTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          description: 'Estorno por erro de processamento',
        }),
      });
    });

    it('deve lançar NotFoundException quando saldo não existe', async () => {
      const tx = mockPrisma.__tx;
      tx.creditTransaction.findMany.mockResolvedValue([]);
      tx.creditBalance.findUnique.mockResolvedValue(null);

      await expect(
        service.partialRefund('user-sem-saldo', 10, 'gen-x'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
