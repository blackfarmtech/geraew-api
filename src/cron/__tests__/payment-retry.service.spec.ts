import { Test, TestingModule } from '@nestjs/testing';
import { PaymentRetryService } from '../payment-retry.service';
import { PrismaService } from '../../prisma/prisma.service';

// ── Fixtures ─────────────────────────────────────────────────────────

const mockPlanFree = {
  id: 'plan-free',
  slug: 'free',
  name: 'Free',
  priceCents: 0,
  creditsPerMonth: 300,
};

const mockPlanStarter = {
  id: 'plan-starter',
  slug: 'starter',
  name: 'Starter',
  priceCents: 2990,
  creditsPerMonth: 10000,
};

const makeSubscription = (overrides: Record<string, any> = {}) => ({
  id: 'sub-1',
  userId: 'user-1',
  planId: 'plan-starter',
  status: 'PAST_DUE',
  currentPeriodStart: new Date('2026-03-01'),
  currentPeriodEnd: new Date('2026-04-01'),
  cancelAtPeriodEnd: false,
  paymentRetryCount: 0,
  plan: mockPlanStarter,
  user: { id: 'user-1', email: 'user@test.com' },
  ...overrides,
});

// ── Mocks ────────────────────────────────────────────────────────────

const createMockPrisma = () => {
  const tx = {
    subscription: {
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({ id: 'sub-new' }),
    },
    creditBalance: {
      upsert: jest.fn().mockResolvedValue({}),
    },
  };

  return {
    subscription: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
    },
    plan: {
      findUnique: jest.fn().mockResolvedValue(mockPlanFree),
    },
    $transaction: jest.fn((fn) => fn(tx)),
    _tx: tx,
  };
};

let mockPrisma: ReturnType<typeof createMockPrisma>;

describe('PaymentRetryService', () => {
  let service: PaymentRetryService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma = createMockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentRetryService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PaymentRetryService>(PaymentRetryService);
  });

  // ══════════════════════════════════════════════════════════════════
  // RETRY DE PAGAMENTO
  // ══════════════════════════════════════════════════════════════════

  describe('handlePaymentRetry', () => {
    it('deve incrementar retryCount quando menor que 3', async () => {
      const sub = makeSubscription({ paymentRetryCount: 1 });
      mockPrisma.subscription.findMany.mockResolvedValue([sub]);

      await service.handlePaymentRetry();

      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: { paymentRetryCount: 2 },
      });
    });

    it('deve fazer downgrade para Free após 3 tentativas falhas', async () => {
      const sub = makeSubscription({ paymentRetryCount: 3 });
      mockPrisma.subscription.findMany.mockResolvedValue([sub]);

      await service.handlePaymentRetry();

      expect(mockPrisma.plan.findUnique).toHaveBeenCalledWith({
        where: { slug: 'free' },
      });
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('deve criar nova assinatura Free no downgrade', async () => {
      const sub = makeSubscription({ paymentRetryCount: 3 });
      mockPrisma.subscription.findMany.mockResolvedValue([sub]);

      await service.handlePaymentRetry();

      // Verifica que a assinatura antiga foi cancelada
      expect(mockPrisma._tx.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub-1' },
          data: { status: 'CANCELED' },
        }),
      );

      // Verifica que uma nova assinatura Free foi criada
      expect(mockPrisma._tx.subscription.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            planId: 'plan-free',
            status: 'ACTIVE',
          }),
        }),
      );
    });

    it('deve resetar créditos para os valores do plano Free no downgrade', async () => {
      const sub = makeSubscription({ paymentRetryCount: 4 });
      mockPrisma.subscription.findMany.mockResolvedValue([sub]);

      await service.handlePaymentRetry();

      expect(mockPrisma._tx.creditBalance.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          update: expect.objectContaining({
            planCreditsRemaining: 300,
            planCreditsUsed: 0,
          }),
        }),
      );
    });

    it('não deve fazer nada quando não há assinaturas PAST_DUE', async () => {
      mockPrisma.subscription.findMany.mockResolvedValue([]);

      await service.handlePaymentRetry();

      expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('deve lidar graciosamente quando o plano Free não existe', async () => {
      const sub = makeSubscription({ paymentRetryCount: 3 });
      mockPrisma.subscription.findMany.mockResolvedValue([sub]);
      mockPrisma.plan.findUnique.mockResolvedValue(null);

      await service.handlePaymentRetry();

      // Não deve crashar e não deve criar transação
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
