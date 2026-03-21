import { Test, TestingModule } from '@nestjs/testing';
import { StuckGenerationsService } from '../stuck-generations.service';
import { PrismaService } from '../../prisma/prisma.service';

// ── Fixtures ─────────────────────────────────────────────────────────

const makeGeneration = (overrides: Record<string, any> = {}) => ({
  id: 'gen-1',
  userId: 'user-1',
  status: 'PROCESSING',
  creditsConsumed: 15,
  createdAt: new Date('2026-03-01T10:00:00Z'),
  ...overrides,
});

const mockCreditBalance = {
  userId: 'user-1',
  planCreditsRemaining: 500,
  bonusCreditsRemaining: 200,
  planCreditsUsed: 500,
};

// ── Mocks ────────────────────────────────────────────────────────────

const createMockPrisma = () => {
  const tx = {
    generation: {
      update: jest.fn().mockResolvedValue({}),
    },
    creditTransaction: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'ct-1' }),
    },
    creditBalance: {
      findUnique: jest.fn().mockResolvedValue(mockCreditBalance),
      update: jest.fn().mockResolvedValue({}),
    },
  };

  return {
    generation: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn((fn) => fn(tx)),
    _tx: tx,
  };
};

let mockPrisma: ReturnType<typeof createMockPrisma>;

describe('StuckGenerationsService', () => {
  let service: StuckGenerationsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma = createMockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StuckGenerationsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<StuckGenerationsService>(StuckGenerationsService);
  });

  // ══════════════════════════════════════════════════════════════════
  // GERAÇÕES TRAVADAS
  // ══════════════════════════════════════════════════════════════════

  describe('handleStuckGenerations', () => {
    it('deve marcar geração travada como FAILED com código GENERATION_TIMEOUT', async () => {
      const gen = makeGeneration();
      mockPrisma.generation.findMany.mockResolvedValue([gen]);

      await service.handleStuckGenerations();

      expect(mockPrisma._tx.generation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'gen-1' },
          data: expect.objectContaining({
            status: 'FAILED',
            errorCode: 'GENERATION_TIMEOUT',
          }),
        }),
      );
    });

    it('deve estornar créditos do plano a partir de transações de débito do plano', async () => {
      const gen = makeGeneration({ creditsConsumed: 15 });
      mockPrisma.generation.findMany.mockResolvedValue([gen]);

      mockPrisma._tx.creditTransaction.findMany.mockResolvedValue([
        { id: 'ct-debit-1', source: 'plan', amount: -10, type: 'GENERATION_DEBIT' },
        { id: 'ct-debit-2', source: 'plan', amount: -5, type: 'GENERATION_DEBIT' },
      ]);

      await service.handleStuckGenerations();

      // Verifica atualização do saldo com estorno de 15 créditos do plano
      expect(mockPrisma._tx.creditBalance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          data: expect.objectContaining({
            planCreditsRemaining: 500 + 15,
            planCreditsUsed: 500 - 15,
          }),
        }),
      );

      // Verifica criação da transação de estorno do plano
      expect(mockPrisma._tx.creditTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            type: 'GENERATION_REFUND',
            amount: 15,
            source: 'plan',
            generationId: 'gen-1',
          }),
        }),
      );
    });

    it('deve estornar créditos bônus a partir de transações de débito bônus', async () => {
      const gen = makeGeneration({ creditsConsumed: 10 });
      mockPrisma.generation.findMany.mockResolvedValue([gen]);

      mockPrisma._tx.creditTransaction.findMany.mockResolvedValue([
        { id: 'ct-debit-1', source: 'plan', amount: -6, type: 'GENERATION_DEBIT' },
        { id: 'ct-debit-2', source: 'bonus', amount: -4, type: 'GENERATION_DEBIT' },
      ]);

      await service.handleStuckGenerations();

      expect(mockPrisma._tx.creditBalance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            planCreditsRemaining: 500 + 6,
            bonusCreditsRemaining: 200 + 4,
            planCreditsUsed: 500 - 6,
          }),
        }),
      );

      // Deve criar duas transações de estorno (plan + bonus)
      expect(mockPrisma._tx.creditTransaction.create).toHaveBeenCalledTimes(2);
    });

    it('deve usar estorno bônus como fallback quando não há registros de débito', async () => {
      const gen = makeGeneration({ creditsConsumed: 20 });
      mockPrisma.generation.findMany.mockResolvedValue([gen]);

      // Sem transações de débito
      mockPrisma._tx.creditTransaction.findMany.mockResolvedValue([]);

      await service.handleStuckGenerations();

      expect(mockPrisma._tx.creditBalance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            bonusCreditsRemaining: 200 + 20,
          }),
        }),
      );

      expect(mockPrisma._tx.creditTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'GENERATION_REFUND',
            amount: 20,
            source: 'bonus',
          }),
        }),
      );
    });

    it('deve pular estorno quando creditsConsumed é 0', async () => {
      const gen = makeGeneration({ creditsConsumed: 0 });
      mockPrisma.generation.findMany.mockResolvedValue([gen]);

      await service.handleStuckGenerations();

      // Deve marcar como FAILED
      expect(mockPrisma._tx.generation.update).toHaveBeenCalled();

      // Não deve tocar no saldo nem criar transação de estorno
      expect(mockPrisma._tx.creditBalance.update).not.toHaveBeenCalled();
      expect(mockPrisma._tx.creditTransaction.create).not.toHaveBeenCalled();
    });

    it('não deve fazer nada quando não há gerações travadas', async () => {
      mockPrisma.generation.findMany.mockResolvedValue([]);

      await service.handleStuckGenerations();

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('deve continuar processando se uma geração falhar', async () => {
      const gen1 = makeGeneration({ id: 'gen-1' });
      const gen2 = makeGeneration({ id: 'gen-2', userId: 'user-2' });
      mockPrisma.generation.findMany.mockResolvedValue([gen1, gen2]);

      mockPrisma.$transaction
        .mockRejectedValueOnce(new Error('DB error'))
        .mockImplementationOnce((fn) => fn(mockPrisma._tx));

      await service.handleStuckGenerations();

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(2);
    });

    it('deve lidar graciosamente quando creditBalance não existe', async () => {
      const gen = makeGeneration({ creditsConsumed: 10 });
      mockPrisma.generation.findMany.mockResolvedValue([gen]);

      mockPrisma._tx.creditTransaction.findMany.mockResolvedValue([
        { id: 'ct-1', source: 'plan', amount: -10, type: 'GENERATION_DEBIT' },
      ]);
      mockPrisma._tx.creditBalance.findUnique.mockResolvedValue(null);

      await service.handleStuckGenerations();

      // Deve marcar como FAILED sem crashar
      expect(mockPrisma._tx.generation.update).toHaveBeenCalled();
      // Não deve tentar atualizar saldo inexistente
      expect(mockPrisma._tx.creditBalance.update).not.toHaveBeenCalled();
    });
  });
});
