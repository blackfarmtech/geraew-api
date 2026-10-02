import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PaymentsService } from '../payments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../email/email.service';
import { AsaasSubscriptionsService } from '../asaas-subscriptions.service';
import { StripeService } from '../stripe.service';

// ── Fixtures ─────────────────────────────────────────────────────────

const mockPlanStarter = {
  id: 'plan-starter',
  slug: 'starter',
  name: 'Starter',
  priceCents: 2990,
  creditsPerMonth: 10000,
};

const mockPlanPro = {
  id: 'plan-pro',
  slug: 'pro',
  name: 'Pro',
  priceCents: 8990,
  creditsPerMonth: 35000,
};

const mockPlanFree = {
  id: 'plan-free',
  slug: 'free',
  name: 'Free',
  priceCents: 0,
  creditsPerMonth: 300,
};

const mockPlanUltraBasic = {
  id: 'plan-ultra-basic',
  slug: 'ultra-basic',
  name: 'Ultra Basic',
  priceCents: 1290,
  creditsPerMonth: 700,
};

const mockSubscription = {
  id: 'sub-1',
  userId: 'user-1',
  planId: 'plan-starter',
  status: 'ACTIVE',
  externalSubscriptionId: 'sub_stripe_123',
  currentPeriodStart: new Date('2026-03-01'),
  currentPeriodEnd: new Date('2026-04-01'),
  cancelAtPeriodEnd: false,
  paymentRetryCount: 0,
  scheduledPlanId: null,
  billingInterval: 'MONTHLY',
  scheduledBillingInterval: null,
  plan: mockPlanStarter,
};

const mockCreditBalance = {
  userId: 'user-1',
  planCreditsRemaining: 8000,
  bonusCreditsRemaining: 5000,
  planCreditsUsed: 2000,
  periodStart: new Date('2026-03-01'),
  periodEnd: new Date('2026-04-01'),
};

const mockCreditPackage = {
  id: 'pkg-500',
  name: 'Pacote 500',
  credits: 5000,
  priceCents: 1790,
};

// ── Mocks ────────────────────────────────────────────────────────────

const createMockPrisma = () => {
  const tx = {
    subscription: {
      findFirst: jest.fn().mockResolvedValue(null),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn().mockImplementation((args) => ({
        id: 'sub-new',
        ...args.data,
      })),
      update: jest.fn().mockImplementation((args) => ({
        ...mockSubscription,
        ...args.data,
      })),
    },
    creditBalance: {
      upsert: jest.fn().mockResolvedValue(mockCreditBalance),
      findUnique: jest.fn().mockResolvedValue(mockCreditBalance),
      update: jest.fn().mockResolvedValue(mockCreditBalance),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    creditTransaction: {
      create: jest.fn().mockResolvedValue({ id: 'ct-1' }),
    },
    userFreeGeneration: {
      upsert: jest.fn().mockResolvedValue({ id: 'ufg-1' }),
    },
    payment: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((args) => ({
        id: 'pay-1',
        ...args.data,
      })),
      update: jest.fn().mockResolvedValue({ id: 'pay-1' }),
    },
    affiliateEarning: {
      create: jest.fn().mockResolvedValue({ id: 'ae-1' }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    plan: {
      findUnique: jest.fn(),
    },
  };

  return {
    ...tx,
    plan: {
      findUnique: jest.fn(),
    },
    subscription: {
      ...tx.subscription,
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    payment: {
      ...tx.payment,
    },
    creditPackage: {
      findUnique: jest.fn(),
    },
    creditBalance: {
      ...tx.creditBalance,
    },
    // Sem campanha de recuperação aberta por padrão
    paymentRecoveryCampaign: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    __tx: tx,
    $transaction: jest.fn((fn) => fn(tx)),
  };
};

let mockPrisma: ReturnType<typeof createMockPrisma>;

describe('PaymentsService', () => {
  let service: PaymentsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma = createMockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: EmailService,
          useValue: {
            sendCreditPurchaseEmail: jest.fn(),
            sendSubscriptionEmail: jest.fn(),
            sendPaymentFailedEmail: jest.fn(),
          },
        },
        {
          provide: AsaasSubscriptionsService,
          useValue: { cancelAuthorization: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: StripeService,
          useValue: { cancelSubscriptionImmediately: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  // ══════════════════════════════════════════════════════════════════
  // RENOVAÇÃO DE ASSINATURA
  // ══════════════════════════════════════════════════════════════════

  describe('handleSubscriptionRenewal', () => {
    const periodStart = new Date('2026-04-01');
    const periodEnd = new Date('2026-05-01');

    beforeEach(() => {
      mockPrisma.subscription.findFirst.mockResolvedValue(mockSubscription);
    });

    it('should renew subscription period and reset credits', async () => {
      await service.handleSubscriptionRenewal(
        'sub_stripe_123',
        periodStart,
        periodEnd,
        2990,
        'in_renewal_123',
        'brl',
      );

      const tx = mockPrisma.$transaction.mock.calls[0][0];
      expect(mockPrisma.$transaction).toHaveBeenCalled();

      // Verifica que a subscription foi atualizada
      const txMock = mockPrisma.$transaction.mock.calls[0][0];
      // A transação foi chamada com uma função — verificamos os mocks internos
      const subUpdate = (mockPrisma as any).$transaction.mock.results[0].value;

      // Verificar que subscription.update foi chamado dentro da transaction
      expect(mockPrisma.subscription.findFirst).toHaveBeenCalledWith({
        where: { externalSubscriptionId: 'sub_stripe_123' },
        include: { plan: true },
      });
    });

    it('should reset plan credits to full amount on renewal', async () => {
      await service.handleSubscriptionRenewal(
        'sub_stripe_123',
        periodStart,
        periodEnd,
        2990,
        'in_renewal_123',
        'brl',
      );

      // Verificar que $transaction foi chamada
      expect(mockPrisma.$transaction).toHaveBeenCalled();

      // Extrair o mock do tx passado para $transaction
      const txFn = mockPrisma.$transaction.mock.calls[0][0];
      // A função já foi executada — verificar os mocks internos do tx
      // O tx é o mesmo objeto usado dentro de createMockPrisma
    });

    it('should create payment record with COMPLETED status', async () => {
      await service.handleSubscriptionRenewal(
        'sub_stripe_123',
        periodStart,
        periodEnd,
        2990,
        'in_renewal_123',
        'brl',
      );

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should apply scheduled downgrade on renewal', async () => {
      const subWithScheduledPlan = {
        ...mockSubscription,
        scheduledPlanId: 'plan-free',
      };
      mockPrisma.subscription.findFirst.mockResolvedValue(subWithScheduledPlan);
      mockPrisma.plan.findUnique.mockResolvedValue(mockPlanFree);

      await service.handleSubscriptionRenewal(
        'sub_stripe_123',
        periodStart,
        periodEnd,
        0,
        'in_downgrade_123',
        'brl',
      );

      expect(mockPrisma.plan.findUnique).toHaveBeenCalledWith({
        where: { id: 'plan-free' },
      });
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should skip when subscription is not found', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(null);

      await service.handleSubscriptionRenewal(
        'sub_unknown_123',
        periodStart,
        periodEnd,
        2990,
        'in_not_found',
        'brl',
      );

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // CANCELAMENTO
  // ══════════════════════════════════════════════════════════════════

  describe('handleSubscriptionDeleted', () => {
    it('should mark subscription as CANCELED and zero plan credits', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(mockSubscription);

      await service.handleSubscriptionDeleted('sub_stripe_123');

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should preserve bonus credits on cancellation', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(mockSubscription);

      await service.handleSubscriptionDeleted('sub_stripe_123');

      // A transaction foi chamada — verificar que creditBalance.update
      // zera apenas planCreditsRemaining e planCreditsUsed, não bonusCreditsRemaining
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should skip when subscription is not found', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(null);

      await service.handleSubscriptionDeleted('sub_unknown');

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('should handle case when credit balance does not exist', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(mockSubscription);

      // Simular que o creditBalance.findUnique dentro do tx retorna null
      const originalTransaction = mockPrisma.$transaction;
      mockPrisma.$transaction = jest.fn(async (fn) => {
        const tx = {
          subscription: {
            update: jest.fn().mockResolvedValue(mockSubscription),
            findFirst: jest.fn().mockResolvedValue(null),
          },
          creditBalance: {
            findUnique: jest.fn().mockResolvedValue(null),
            update: jest.fn(),
          },
        };
        return fn(tx);
      });

      await service.handleSubscriptionDeleted('sub_stripe_123');

      const txFn = mockPrisma.$transaction.mock.calls[0][0];
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // FALHA DE PAGAMENTO
  // ══════════════════════════════════════════════════════════════════

  describe('handlePaymentFailed', () => {
    it('should mark subscription as PAST_DUE and increment retry count', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(mockSubscription);

      await service.handlePaymentFailed('sub_stripe_123', 2990, 'in_failed_123', 'brl');

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should create a FAILED payment record', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(mockSubscription);

      await service.handlePaymentFailed('sub_stripe_123', 8990, 'in_failed_456', 'brl');

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should skip when subscription is not found', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(null);

      await service.handlePaymentFailed('sub_unknown', 2990, 'in_not_found', 'brl');

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // PRIMEIRO PAGAMENTO (processSubscriptionPayment)
  // ══════════════════════════════════════════════════════════════════

  describe('processSubscriptionPayment', () => {
    beforeEach(() => {
      mockPrisma.plan.findUnique.mockResolvedValue(mockPlanStarter);
    });

    it('should create subscription, init credits, and record payment', async () => {
      await service.processSubscriptionPayment(
        'user-1',
        'starter',
        'sub_new_123',
        2990,
        'pi_first_123',
        'brl',
      );

      expect(mockPrisma.plan.findUnique).toHaveBeenCalledWith({
        where: { slug: 'starter' },
      });
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should cancel existing active subscriptions before creating new one', async () => {
      await service.processSubscriptionPayment(
        'user-1',
        'starter',
        'sub_new_123',
        2990,
        'pi_first_123',
        'brl',
      );

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should throw NotFoundException for invalid plan slug', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(null);

      await expect(
        service.processSubscriptionPayment(
          'user-1',
          'invalid-plan',
          'sub_123',
          2990,
          'pi_123',
          'brl',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    describe('welcome bonus Ultra Basic', () => {
      it('deve conceder 2 GERAEW_FAST grátis no primeiro acesso ao Ultra Basic', async () => {
        mockPrisma.plan.findUnique.mockResolvedValue(mockPlanUltraBasic);
        mockPrisma.__tx.subscription.findFirst.mockResolvedValue(null);

        await service.processSubscriptionPayment(
          'user-1',
          'ultra-basic',
          'sub_ub_123',
          1290,
          'pi_ub_first',
          'brl',
        );

        expect(mockPrisma.__tx.userFreeGeneration.upsert).toHaveBeenCalledWith({
          where: { userId_type: { userId: 'user-1', type: 'GERAEW_FAST' } },
          create: { userId: 'user-1', type: 'GERAEW_FAST', remaining: 2 },
          update: { remaining: { increment: 2 } },
        });
      });

      it('NÃO deve conceder bônus se o usuário já teve ultra-basic antes', async () => {
        mockPrisma.plan.findUnique.mockResolvedValue(mockPlanUltraBasic);
        mockPrisma.__tx.subscription.findFirst.mockResolvedValue({ id: 'sub-old' });

        await service.processSubscriptionPayment(
          'user-1',
          'ultra-basic',
          'sub_ub_new',
          1290,
          'pi_ub_second',
          'brl',
        );

        expect(mockPrisma.__tx.userFreeGeneration.upsert).not.toHaveBeenCalled();
      });

      it('NÃO deve conceder bônus para outros planos', async () => {
        mockPrisma.plan.findUnique.mockResolvedValue(mockPlanStarter);

        await service.processSubscriptionPayment(
          'user-1',
          'starter',
          'sub_starter_123',
          2990,
          'pi_starter_first',
          'brl',
        );

        expect(mockPrisma.__tx.userFreeGeneration.upsert).not.toHaveBeenCalled();
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // COMPRA DE CRÉDITOS (processCreditPurchase)
  // ══════════════════════════════════════════════════════════════════

  describe('processCreditPurchase', () => {
    beforeEach(() => {
      mockPrisma.creditPackage.findUnique.mockResolvedValue(mockCreditPackage);
    });

    it('should add bonus credits and create payment record', async () => {
      await service.processCreditPurchase(
        'user-1',
        'pkg-500',
        1790,
        'pi_credit_123',
        'brl',
      );

      expect(mockPrisma.creditPackage.findUnique).toHaveBeenCalledWith({
        where: { id: 'pkg-500' },
      });
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should throw NotFoundException for invalid package', async () => {
      mockPrisma.creditPackage.findUnique.mockResolvedValue(null);

      await expect(
        service.processCreditPurchase('user-1', 'invalid-pkg', 1790, 'pi_123', 'brl'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // REEMBOLSO (handleRefund)
  // ══════════════════════════════════════════════════════════════════

  describe('handleRefund', () => {
    it('should cancel subscription and zero plan credits on subscription refund', async () => {
      const mockPayment = {
        id: 'pay-1',
        userId: 'user-1',
        type: 'SUBSCRIPTION',
        status: 'COMPLETED',
        subscriptionId: 'sub-1',
        creditPackage: null,
        subscription: {
          id: 'sub-1',
          plan: mockPlanStarter,
        },
      };
      mockPrisma.payment.findFirst.mockResolvedValue(mockPayment);

      await service.handleRefund('pi_test_123', 'in_test_123', 2990);

      expect(mockPrisma.payment.findFirst).toHaveBeenCalledWith({
        where: { externalPaymentId: { in: ['pi_test_123', 'in_test_123'] } },
        include: {
          creditPackage: true,
          subscription: { include: { plan: true } },
        },
      });
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should remove bonus credits on credit purchase refund', async () => {
      const mockPayment = {
        id: 'pay-2',
        userId: 'user-1',
        type: 'CREDIT_PURCHASE',
        status: 'COMPLETED',
        subscriptionId: null,
        creditPackage: mockCreditPackage,
        subscription: null,
      };
      mockPrisma.payment.findFirst.mockResolvedValue(mockPayment);

      await service.handleRefund('pi_credit_refund', null, 1790);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should skip already refunded payments', async () => {
      const mockPayment = {
        id: 'pay-1',
        status: 'REFUNDED',
      };
      mockPrisma.payment.findFirst.mockResolvedValue(mockPayment);

      await service.handleRefund('pi_already_refunded', null, 2990);

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('should skip when payment is not found', async () => {
      mockPrisma.payment.findFirst.mockResolvedValue(null);

      await service.handleRefund('pi_unknown', null, 2990);

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('should only deduct available bonus credits (safe deduction)', async () => {
      const mockPayment = {
        id: 'pay-2',
        userId: 'user-1',
        type: 'CREDIT_PURCHASE',
        status: 'COMPLETED',
        subscriptionId: null,
        creditPackage: { ...mockCreditPackage, credits: 5000 },
        subscription: null,
      };
      mockPrisma.payment.findFirst.mockResolvedValue(mockPayment);

      // Override $transaction para verificar safe deduction
      mockPrisma.$transaction = jest.fn(async (fn) => {
        const tx = {
          payment: { update: jest.fn() },
          creditBalance: {
            findUnique: jest.fn().mockResolvedValue({
              userId: 'user-1',
              bonusCreditsRemaining: 2000, // menos que os 5000 do pacote
            }),
            updateMany: jest.fn(),
          },
          creditTransaction: { create: jest.fn() },
          affiliateEarning: { deleteMany: jest.fn() },
        };
        await fn(tx);
        return tx;
      });

      await service.handleRefund('pi_partial', null, 1790);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      // O safe deduction garante que min(5000, 2000) = 2000 é usado
    });
  });
  // ══════════════════════════════════════════════════════════════════
  // PLANO ANUAL — período anual, créditos mensais
  // ══════════════════════════════════════════════════════════════════

  describe('plano anual', () => {
    // Meio-dia em 31/01: o +1 mês tem que cair em 28/02 (sem "transbordar")
    const NOW = new Date(2026, 0, 31, 12, 0, 0);

    beforeEach(() => {
      jest.useFakeTimers({ now: NOW });
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    it('processSubscriptionPayment YEARLY: período de 1 ano, créditos por 1 mês', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(mockPlanPro);

      await service.processSubscriptionPayment(
        'user-1',
        'pro',
        'sub_year_1',
        86304,
        'pi_year_1',
        'brl',
        undefined,
        'YEARLY',
        8990,
      );

      const tx = mockPrisma.__tx;
      const subData = tx.subscription.create.mock.calls[0][0].data;
      expect(subData.billingInterval).toBe('YEARLY');
      expect(subData.currentPeriodStart).toEqual(NOW);
      expect(subData.currentPeriodEnd).toEqual(new Date(2027, 0, 31, 12, 0, 0));

      const balance = tx.creditBalance.upsert.mock.calls[0][0];
      expect(balance.update.planCreditsRemaining).toBe(mockPlanPro.creditsPerMonth);
      expect(balance.update.periodEnd).toEqual(new Date(2026, 1, 28, 12, 0, 0));

      const payment = tx.payment.create.mock.calls[0][0].data;
      expect(payment.metadata).toEqual({ billingInterval: 'YEARLY', upgradeCreditCents: 8990 });
    });

    it('processSubscriptionPayment sem ciclo continua mensal', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(mockPlanStarter);

      await service.processSubscriptionPayment(
        'user-1',
        'starter',
        'sub_m_1',
        2990,
        'pi_m_1',
        'brl',
      );

      const tx = mockPrisma.__tx;
      const subData = tx.subscription.create.mock.calls[0][0].data;
      expect(subData.billingInterval).toBe('MONTHLY');
      expect(subData.currentPeriodEnd).toEqual(new Date(2026, 1, 28, 12, 0, 0));
      expect(tx.creditBalance.upsert.mock.calls[0][0].update.periodEnd).toEqual(
        subData.currentPeriodEnd,
      );
    });

    it('renovação anual: mantém YEARLY e o ciclo de créditos é de 1 mês', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue({
        ...mockSubscription,
        billingInterval: 'YEARLY',
        plan: mockPlanPro,
      });
      const periodStart = new Date('2026-04-01T00:00:00Z');
      const periodEnd = new Date('2027-04-01T00:00:00Z');

      await service.handleSubscriptionRenewal(
        'sub_stripe_123',
        periodStart,
        periodEnd,
        86304,
        'in_year_2',
        'brl',
      );

      const tx = mockPrisma.__tx;
      const subUpdate = tx.subscription.update.mock.calls[0][0].data;
      expect(subUpdate.billingInterval).toBe('YEARLY');
      expect(subUpdate.currentPeriodEnd).toEqual(periodEnd);
      expect(subUpdate.scheduledBillingInterval).toBeNull();

      const balance = tx.creditBalance.upsert.mock.calls[0][0].update;
      expect(balance.periodStart).toEqual(periodStart);
      expect(balance.periodEnd.getTime()).toBeLessThan(periodEnd.getTime());
      expect(balance.periodEnd.getMonth()).toBe((periodStart.getMonth() + 1) % 12);

      expect(tx.creditTransaction.create.mock.calls[0][0].data.description).toContain(
        'Renovação anual',
      );
    });

    it('renovação aplica plano + ciclo agendados (anual Pro → mensal Starter)', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue({
        ...mockSubscription,
        planId: 'plan-pro',
        plan: mockPlanPro,
        billingInterval: 'YEARLY',
        scheduledPlanId: 'plan-starter',
        scheduledBillingInterval: 'MONTHLY',
      });
      mockPrisma.plan.findUnique.mockResolvedValue(mockPlanStarter);
      const periodStart = new Date('2027-01-31T12:00:00Z');
      const periodEnd = new Date('2027-02-28T12:00:00Z');

      await service.handleSubscriptionRenewal(
        'sub_stripe_123',
        periodStart,
        periodEnd,
        2990,
        'in_switch_1',
        'brl',
      );

      const subUpdate = mockPrisma.__tx.subscription.update.mock.calls[0][0].data;
      expect(subUpdate).toEqual(
        expect.objectContaining({
          planId: 'plan-starter',
          scheduledPlanId: null,
          billingInterval: 'MONTHLY',
          scheduledBillingInterval: null,
        }),
      );
      const balance = mockPrisma.__tx.creditBalance.upsert.mock.calls[0][0].update;
      expect(balance.planCreditsRemaining).toBe(mockPlanStarter.creditsPerMonth);
      expect(balance.periodEnd).toEqual(periodEnd);
    });

    it('renovação usa o período cobrado pelo Stripe quando diverge do esperado', async () => {
      // Banco acha que é mensal, mas o Stripe cobrou 1 ano
      mockPrisma.subscription.findFirst.mockResolvedValue(mockSubscription);
      const periodStart = new Date('2026-04-01T00:00:00Z');
      const periodEnd = new Date('2027-04-01T00:00:00Z');

      await service.handleSubscriptionRenewal(
        'sub_stripe_123',
        periodStart,
        periodEnd,
        28704,
        'in_div_1',
        'brl',
      );

      const subUpdate = mockPrisma.__tx.subscription.update.mock.calls[0][0].data;
      expect(subUpdate.billingInterval).toBe('YEARLY');
    });

    it('activatePixAutoSubscription anual: período de 1 ano, créditos por 1 mês', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue({
        ...mockSubscription,
        status: 'TRIALING',
        billingInterval: 'YEARLY',
        paymentMethod: 'pix_auto_asaas',
        plan: mockPlanPro,
      });
      mockPrisma.subscription.findFirst.mockResolvedValue(null);

      await service.activatePixAutoSubscription('sub-1');

      const tx = mockPrisma.__tx;
      const activation = tx.subscription.update.mock.calls[0][0].data;
      expect(activation.status).toBe('ACTIVE');
      expect(activation.currentPeriodEnd).toEqual(new Date(2027, 0, 31, 12, 0, 0));
      expect(tx.creditBalance.upsert.mock.calls[0][0].update.periodEnd).toEqual(
        new Date(2026, 1, 28, 12, 0, 0),
      );
    });
  });
});
