import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { SubscriptionsService } from '../subscriptions.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PlansService } from '../../plans/plans.service';
import { StripeService } from '../../payments/stripe.service';
import { CreditsService } from '../../credits/credits.service';
import { ConfigService } from '@nestjs/config';
import { AsaasService } from '../../payments/asaas.service';
import { AsaasSubscriptionsService } from '../../payments/asaas-subscriptions.service';
import { PaymentsService } from '../../payments/payments.service';
import { annualPriceFromMonthly } from '../../plans/billing-interval';

// Fora de request não há I18nContext e o t() devolve a chave crua — nos testes
// resolvemos com as mensagens pt-BR reais, para validar o texto que o usuário vê.
jest.mock('../../common/i18n/t', () => ({
  t: (key: string) => {
    const ptBrErrors = jest.requireActual('../../i18n/pt-BR/errors.json');
    const value = key
      .replace(/^errors\./, '')
      .split('.')
      .reduce<any>((acc, part) => acc?.[part], ptBrErrors);
    return typeof value === 'string' ? value : key;
  },
}));

// ── Fixtures ─────────────────────────────────────────────────────────

const mockPlanFree = {
  id: 'plan-free',
  slug: 'free',
  name: 'Free',
  priceCents: 0,
  creditsPerMonth: 300,
  maxConcurrentGenerations: 1,
  hasWatermark: true,
  galleryRetentionDays: 30,
  hasApiAccess: false,
  stripePriceId: null,
};

const mockPlanStarter = {
  id: 'plan-starter',
  slug: 'starter',
  name: 'Starter',
  priceCents: 2990,
  creditsPerMonth: 10000,
  maxConcurrentGenerations: 2,
  hasWatermark: false,
  galleryRetentionDays: null,
  hasApiAccess: false,
  stripePriceId: 'price_starter_123',
};

const mockPlanPro = {
  id: 'plan-pro',
  slug: 'pro',
  name: 'Pro',
  priceCents: 8990,
  creditsPerMonth: 35000,
  maxConcurrentGenerations: 5,
  hasWatermark: false,
  galleryRetentionDays: null,
  hasApiAccess: false,
  stripePriceId: 'price_pro_123',
};

const mockPlanStudio = {
  id: 'plan-studio',
  slug: 'studio',
  name: 'Studio',
  priceCents: 36990,
  creditsPerMonth: 80000,
  maxConcurrentGenerations: 10,
  hasWatermark: false,
  galleryRetentionDays: null,
  hasApiAccess: true,
  stripePriceId: 'price_studio_123',
};

const mockUser = {
  email: 'user@test.com',
  name: 'Test User',
};

const now = new Date('2026-03-01');
const periodEnd = new Date('2026-04-01');

const buildSubscription = (plan: any, overrides: any = {}) => ({
  id: 'sub-1',
  userId: 'user-1',
  planId: plan.id,
  status: 'ACTIVE',
  externalSubscriptionId: 'sub_stripe_123',
  currentPeriodStart: now,
  currentPeriodEnd: periodEnd,
  cancelAtPeriodEnd: false,
  paymentProvider: 'stripe',
  paymentRetryCount: 0,
  scheduledPlanId: null,
  retentionOfferAcceptedAt: null,
  pausedUntil: null,
  billingInterval: 'MONTHLY',
  scheduledBillingInterval: null,
  createdAt: now,
  plan,
  scheduledPlan: null,
  ...overrides,
});

// ── Mocks ────────────────────────────────────────────────────────────

const mockPrisma = {
  subscription: {
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    create: jest.fn(),
  },
  user: {
    findUniqueOrThrow: jest.fn(),
  },
  payment: {
    findFirst: jest.fn(),
  },
};

const PLANS_BY_ID: Record<string, any> = {
  'plan-free': mockPlanFree,
  'plan-starter': mockPlanStarter,
  'plan-pro': mockPlanPro,
  'plan-studio': mockPlanStudio,
};

const mockPlansService = {
  findPlanBySlug: jest.fn(),
  resolvePlanPrice: jest.fn(
    async (planId: string, _currency?: string, interval: string = 'MONTHLY') => {
      const plan = PLANS_BY_ID[planId];
      const yearly = interval === 'YEARLY';
      return {
        currency: 'BRL',
        priceCents: yearly
          ? annualPriceFromMonthly(plan?.priceCents ?? 0)
          : plan?.priceCents ?? 0,
        stripePriceId: yearly
          ? `${plan?.stripePriceId}_yearly`
          : plan?.stripePriceId ?? null,
      };
    },
  ),
};

const mockStripeService = {
  getOrCreateCustomer: jest.fn(),
  createSubscriptionCheckout: jest.fn(),
  cancelSubscription: jest.fn(),
  reactivateSubscription: jest.fn(),
  scheduleSubscriptionPlanChange: jest.fn(),
  applyRetentionDiscount: jest.fn(),
  pauseSubscription: jest.fn(),
  getSubscriptionDiscount: jest.fn(),
  findLiveSubscription: jest.fn(),
  createBillingPortalSession: jest.fn(),
  scheduleSubscriptionChangeAtPeriodEnd: jest.fn(),
  releaseSubscriptionSchedule: jest.fn(),
};

const mockCreditsService = {
  addBonusCredits: jest.fn(),
};

const mockAsaasService = {
  createSubscription: jest.fn(),
  cancelSubscription: jest.fn(),
  getOrCreateCustomer: jest.fn(),
};

const mockAsaasSubscriptionsService = {
  getAuthorization: jest.fn(),
  createAuthorization: jest.fn(),
  cancelAuthorization: jest.fn(),
};

const mockPaymentsService = {
  activatePixAutoSubscription: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string) =>
    key === 'FRONTEND_URL' ? 'https://geraew.ai' : undefined,
  ),
};

// ── Test Suite ───────────────────────────────────────────────────────

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Default: nenhuma subscription viva no Stripe. Os testes que exercitam a
    // barreira anti-duplicidade sobrescrevem isso.
    mockStripeService.findLiveSubscription.mockResolvedValue(null);
    // Default: nenhuma troca de ciclo agendada (sem Subscription Schedule).
    mockStripeService.releaseSubscriptionSchedule.mockResolvedValue(false);
    mockPrisma.payment.findFirst.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PlansService, useValue: mockPlansService },
        { provide: StripeService, useValue: mockStripeService },
        { provide: CreditsService, useValue: mockCreditsService },
        { provide: AsaasService, useValue: mockAsaasService },
        {
          provide: AsaasSubscriptionsService,
          useValue: mockAsaasSubscriptionsService,
        },
        { provide: PaymentsService, useValue: mockPaymentsService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<SubscriptionsService>(SubscriptionsService);
  });

  // ══════════════════════════════════════════════════════════════════
  // getCurrentSubscription
  // ══════════════════════════════════════════════════════════════════

  describe('getCurrentSubscription', () => {
    it('deve retornar null quando não há assinatura ativa', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(null);

      const result = await service.getCurrentSubscription('user-1');

      expect(result).toBeNull();
      expect(mockPrisma.subscription.findFirst).toHaveBeenCalledWith({
        where: { userId: 'user-1', status: { in: ['ACTIVE', 'PAST_DUE', 'TRIALING'] } },
        orderBy: { createdAt: 'desc' },
        include: { plan: true, scheduledPlan: true },
      });
    });

    it('deve retornar DTO da assinatura quando existe', async () => {
      const subscription = buildSubscription(mockPlanStarter);
      mockPrisma.subscription.findFirst.mockResolvedValue(subscription);
      mockStripeService.getSubscriptionDiscount.mockResolvedValue(null);

      const result = await service.getCurrentSubscription('user-1');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('sub-1');
      expect(result!.status).toBe('ACTIVE');
      expect(result!.plan.slug).toBe('starter');
      expect(result!.plan.priceCents).toBe(2990);
      expect(result!.plan.creditsPerMonth).toBe(10000);
      expect(result!.cancelAtPeriodEnd).toBe(false);
      expect(result!.scheduledPlan).toBeUndefined();
    });

    it('deve retornar assinatura com scheduledPlan quando há downgrade pendente', async () => {
      const subscription = buildSubscription(mockPlanPro, {
        scheduledPlanId: mockPlanStarter.id,
        scheduledPlan: mockPlanStarter,
      });
      mockPrisma.subscription.findFirst.mockResolvedValue(subscription);
      mockStripeService.getSubscriptionDiscount.mockResolvedValue(null);

      const result = await service.getCurrentSubscription('user-1');

      expect(result).not.toBeNull();
      expect(result!.plan.slug).toBe('pro');
      expect(result!.scheduledPlan).toBeDefined();
      expect(result!.scheduledPlan!.slug).toBe('starter');
      expect(result!.scheduledPlan!.priceCents).toBe(2990);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // createSubscription
  // ══════════════════════════════════════════════════════════════════

  describe('createSubscription', () => {
    it('deve criar checkout do Stripe para plano pago válido', async () => {
      mockPlansService.findPlanBySlug.mockResolvedValue(mockPlanStarter);
      mockPrisma.subscription.findFirst.mockResolvedValue(null);
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue(mockUser);
      mockStripeService.getOrCreateCustomer.mockResolvedValue('cus_123');
      mockStripeService.createSubscriptionCheckout.mockResolvedValue('https://checkout.stripe.com/session_123');

      const result = await service.createSubscription('user-1', 'starter');

      expect(result).toEqual({ checkoutUrl: 'https://checkout.stripe.com/session_123' });
      expect(mockPlansService.findPlanBySlug).toHaveBeenCalledWith('starter');
      expect(mockStripeService.getOrCreateCustomer).toHaveBeenCalledWith('user-1', 'user@test.com', 'Test User');
      expect(mockStripeService.createSubscriptionCheckout).toHaveBeenCalledWith(
        'cus_123',
        'starter',
        'Starter',
        2990,
        'user-1',
        'price_starter_123',
        'BRL',
        undefined,
        undefined,
        undefined,
        undefined,
        'MONTHLY',
      );
    });

    it('deve lançar BadRequestException para plano Free', async () => {
      mockPlansService.findPlanBySlug.mockResolvedValue(mockPlanFree);

      await expect(service.createSubscription('user-1', 'free')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.createSubscription('user-1', 'free')).rejects.toThrow(
        'Não é possível criar assinatura para o plano Free',
      );
    });

    it('deve lançar ConflictException quando já possui assinatura paga ativa', async () => {
      mockPlansService.findPlanBySlug.mockResolvedValue(mockPlanPro);
      const existing = buildSubscription(mockPlanStarter);
      mockPrisma.subscription.findFirst.mockResolvedValue(existing);

      await expect(service.createSubscription('user-1', 'pro')).rejects.toThrow(
        ConflictException,
      );
      await expect(service.createSubscription('user-1', 'pro')).rejects.toThrow(
        'Usuário já possui uma assinatura ativa. Use upgrade ou downgrade.',
      );
    });

    // Regressão: cliente com fatura atrasada conseguia passar pelo checkout e
    // criar uma segunda assinatura paralela do mesmo plano. Se o retry do Stripe
    // aprovasse a fatura antiga depois, ele ficava com duas subs cobrando.
    it('deve mandar para o billing portal quando a assinatura está PAST_DUE, sem criar checkout novo', async () => {
      mockPlansService.findPlanBySlug.mockResolvedValue(mockPlanPro);
      mockPrisma.subscription.findFirst.mockResolvedValue(
        buildSubscription(mockPlanPro, { status: 'PAST_DUE' }),
      );
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue(mockUser);
      mockStripeService.getOrCreateCustomer.mockResolvedValue('cus_123');
      mockStripeService.createBillingPortalSession.mockResolvedValue(
        'https://billing.stripe.com/p/session_past_due',
      );

      const result = await service.createSubscription('user-1', 'pro');

      expect(result).toEqual({
        checkoutUrl: 'https://billing.stripe.com/p/session_past_due',
      });
      expect(mockStripeService.createSubscriptionCheckout).not.toHaveBeenCalled();
    });

    it('deve mandar para o billing portal quando o Stripe tem sub viva sem registro no banco', async () => {
      mockPlansService.findPlanBySlug.mockResolvedValue(mockPlanPro);
      mockPrisma.subscription.findFirst.mockResolvedValue(null);
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue(mockUser);
      mockStripeService.getOrCreateCustomer.mockResolvedValue('cus_123');
      mockStripeService.findLiveSubscription.mockResolvedValue({
        id: 'sub_stripe_orfa',
        status: 'past_due',
      });
      mockStripeService.createBillingPortalSession.mockResolvedValue(
        'https://billing.stripe.com/p/session_orfa',
      );

      const result = await service.createSubscription('user-1', 'pro');

      expect(result).toEqual({
        checkoutUrl: 'https://billing.stripe.com/p/session_orfa',
      });
      expect(mockStripeService.createSubscriptionCheckout).not.toHaveBeenCalled();
    });

    it('deve criar customer no Stripe quando não existe', async () => {
      mockPlansService.findPlanBySlug.mockResolvedValue(mockPlanStarter);
      mockPrisma.subscription.findFirst.mockResolvedValue(null);
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue(mockUser);
      mockStripeService.getOrCreateCustomer.mockResolvedValue('cus_new_456');
      mockStripeService.createSubscriptionCheckout.mockResolvedValue('https://checkout.stripe.com/session_456');

      await service.createSubscription('user-1', 'starter');

      expect(mockStripeService.getOrCreateCustomer).toHaveBeenCalledWith(
        'user-1',
        'user@test.com',
        'Test User',
      );
      expect(mockPrisma.user.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: { email: true, name: true },
      });
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // upgrade
  // ══════════════════════════════════════════════════════════════════

  describe('upgrade', () => {
    it('deve fazer upgrade de Free para Starter sem desconto', async () => {
      const currentSub = buildSubscription(mockPlanFree, { externalSubscriptionId: null });
      mockPrisma.subscription.findFirst.mockResolvedValue(currentSub);
      mockPlansService.findPlanBySlug.mockResolvedValue(mockPlanStarter);
      mockPrisma.subscription.update.mockResolvedValue({ ...currentSub, cancelAtPeriodEnd: true });
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue(mockUser);
      mockStripeService.getOrCreateCustomer.mockResolvedValue('cus_123');
      mockStripeService.createSubscriptionCheckout.mockResolvedValue('https://checkout.stripe.com/upgrade_free');

      const result = await service.upgrade('user-1', 'starter');

      expect(result).toEqual({ checkoutUrl: 'https://checkout.stripe.com/upgrade_free' });
      // Free -> Starter: desconto = 0 (free não gera desconto)
      expect(mockStripeService.createSubscriptionCheckout).toHaveBeenCalledWith(
        'cus_123',
        'starter',
        'Starter',
        2990,
        'user-1',
        'price_starter_123',
        'BRL',
        undefined,
        undefined,
        undefined,
        undefined,
        'MONTHLY',
      );
      // Não deve tentar cancelar no Stripe pois externalSubscriptionId é null
      expect(mockStripeService.cancelSubscription).not.toHaveBeenCalled();
    });

    it('deve fazer upgrade de Starter para Pro com desconto do preço do Starter (sem retencao)', async () => {
      const currentSub = buildSubscription(mockPlanStarter);
      mockPrisma.subscription.findFirst.mockResolvedValue(currentSub);
      mockPlansService.findPlanBySlug
        .mockResolvedValueOnce(mockPlanPro) // chamada no upgrade()
        .mockResolvedValueOnce(mockPlanPro); // chamada no buildCheckoutForPlan()
      mockPrisma.subscription.update.mockResolvedValue({ ...currentSub, cancelAtPeriodEnd: true });
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue(mockUser);
      mockStripeService.getOrCreateCustomer.mockResolvedValue('cus_123');
      mockStripeService.cancelSubscription.mockResolvedValue(undefined);
      mockStripeService.getSubscriptionDiscount.mockResolvedValue(null);
      mockStripeService.createSubscriptionCheckout.mockResolvedValue('https://checkout.stripe.com/upgrade_pro');

      const result = await service.upgrade('user-1', 'pro');

      expect(result).toEqual({ checkoutUrl: 'https://checkout.stripe.com/upgrade_pro' });
      // Starter -> Pro: desconto = priceCents do Starter (2990) sem retencao ativa
      expect(mockStripeService.createSubscriptionCheckout).toHaveBeenCalledWith(
        'cus_123',
        'pro',
        'Pro',
        8990,
        'user-1',
        'price_pro_123',
        'BRL',
        2990,
        'sub_stripe_123',
        undefined,
        undefined,
        'MONTHLY',
      );
    });

    it('deve usar desconto real quando retencao esta ativa no upgrade', async () => {
      const currentSub = buildSubscription(mockPlanStarter);
      mockPrisma.subscription.findFirst.mockResolvedValue(currentSub);
      mockPlansService.findPlanBySlug
        .mockResolvedValueOnce(mockPlanPro)
        .mockResolvedValueOnce(mockPlanPro);
      mockPrisma.subscription.update.mockResolvedValue({ ...currentSub, cancelAtPeriodEnd: true });
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue(mockUser);
      mockStripeService.getOrCreateCustomer.mockResolvedValue('cus_123');
      mockStripeService.cancelSubscription.mockResolvedValue(undefined);
      // Retencao ativa: 15% OFF com 1 mes restante
      mockStripeService.getSubscriptionDiscount.mockResolvedValue({
        percentOff: 15,
        amountOffCents: null,
        durationMonths: 2,
        remainingMonths: 1,
      });
      mockStripeService.createSubscriptionCheckout.mockResolvedValue('https://checkout.stripe.com/upgrade_discount');

      const result = await service.upgrade('user-1', 'pro');

      expect(result).toEqual({ checkoutUrl: 'https://checkout.stripe.com/upgrade_discount' });
      // Starter (R$29.90) com 15% OFF = R$25.42 (2542 centavos) = Math.round(2990 * 0.85)
      expect(mockStripeService.createSubscriptionCheckout).toHaveBeenCalledWith(
        'cus_123',
        'pro',
        'Pro',
        8990,
        'user-1',
        'price_pro_123',
        'BRL',
        2542, // 2990 * 0.85 = 2541.5, rounded to 2542
        'sub_stripe_123',
        undefined,
        undefined,
        'MONTHLY',
      );
    });

    it('deve lançar BadRequestException quando já está no mesmo plano', async () => {
      const currentSub = buildSubscription(mockPlanStarter);
      mockPrisma.subscription.findFirst.mockResolvedValue(currentSub);
      mockPlansService.findPlanBySlug.mockResolvedValue(mockPlanStarter);

      await expect(service.upgrade('user-1', 'starter')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.upgrade('user-1', 'starter')).rejects.toThrow(
        'Você já está neste plano.',
      );
    });

    it('NÃO cancela a assinatura antiga no upgrade — só repassa o id para o webhook cancelar', async () => {
      const currentSub = buildSubscription(mockPlanStarter);
      mockPrisma.subscription.findFirst.mockResolvedValue(currentSub);
      mockPlansService.findPlanBySlug.mockResolvedValue(mockPlanPro);
      mockPrisma.subscription.update.mockResolvedValue({ ...currentSub, cancelAtPeriodEnd: true });
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue(mockUser);
      mockStripeService.getOrCreateCustomer.mockResolvedValue('cus_123');
      mockStripeService.cancelSubscription.mockResolvedValue(undefined);
      mockStripeService.getSubscriptionDiscount.mockResolvedValue(null);
      mockStripeService.createSubscriptionCheckout.mockResolvedValue('https://checkout.stripe.com/session');

      await service.upgrade('user-1', 'pro');

      // Se o usuário desistir do checkout, continua com o plano atual.
      expect(mockStripeService.cancelSubscription).not.toHaveBeenCalled();
      expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
      // oldExternalSubscriptionId (9º argumento) vai para a metadata da sessão
      expect(mockStripeService.createSubscriptionCheckout.mock.calls[0][8]).toBe('sub_stripe_123');
    });

    it('deve funcionar quando usuário não tem assinatura atual (primeira vez)', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(null);
      mockPlansService.findPlanBySlug.mockResolvedValue(mockPlanStarter);
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue(mockUser);
      mockStripeService.getOrCreateCustomer.mockResolvedValue('cus_123');
      mockStripeService.createSubscriptionCheckout.mockResolvedValue('https://checkout.stripe.com/first_time');

      const result = await service.upgrade('user-1', 'starter');

      expect(result).toEqual({ checkoutUrl: 'https://checkout.stripe.com/first_time' });
      expect(mockStripeService.cancelSubscription).not.toHaveBeenCalled();
      expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
      // Sem desconto quando não tem assinatura anterior
      expect(mockStripeService.createSubscriptionCheckout).toHaveBeenCalledWith(
        'cus_123',
        'starter',
        'Starter',
        2990,
        'user-1',
        'price_starter_123',
        'BRL',
        undefined,
        undefined,
        undefined,
        undefined,
        'MONTHLY',
      );
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // downgrade
  // ══════════════════════════════════════════════════════════════════

  describe('downgrade', () => {
    it('deve fazer downgrade de Pro para Starter agendando mudança de plano', async () => {
      const currentSub = buildSubscription(mockPlanPro);
      mockPrisma.subscription.findFirst.mockResolvedValue(currentSub);
      mockPlansService.findPlanBySlug.mockResolvedValue(mockPlanStarter);
      mockStripeService.scheduleSubscriptionPlanChange.mockResolvedValue(undefined);
      const updatedSub = buildSubscription(mockPlanPro, {
        scheduledPlanId: mockPlanStarter.id,
        scheduledPlan: mockPlanStarter,
      });
      mockPrisma.subscription.update.mockResolvedValue(updatedSub);

      const result = await service.downgrade('user-1', 'starter');

      expect(result.plan.slug).toBe('pro');
      expect(result.scheduledPlan).toBeDefined();
      expect(result.scheduledPlan!.slug).toBe('starter');
      expect(mockStripeService.scheduleSubscriptionPlanChange).toHaveBeenCalledWith(
        'sub_stripe_123',
        'price_starter_123',
      );
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: { scheduledPlanId: mockPlanStarter.id, scheduledBillingInterval: 'MONTHLY' },
        include: { plan: true, scheduledPlan: true },
      });
    });

    it('deve fazer downgrade de Starter para Free cancelando no fim do período', async () => {
      const currentSub = buildSubscription(mockPlanStarter);
      mockPrisma.subscription.findFirst.mockResolvedValue(currentSub);
      mockPlansService.findPlanBySlug.mockResolvedValue(mockPlanFree);
      mockStripeService.cancelSubscription.mockResolvedValue(undefined);
      const updatedSub = buildSubscription(mockPlanStarter, {
        cancelAtPeriodEnd: true,
        scheduledPlanId: mockPlanFree.id,
        scheduledPlan: mockPlanFree,
      });
      mockPrisma.subscription.update.mockResolvedValue(updatedSub);

      const result = await service.downgrade('user-1', 'free');

      expect(result.cancelAtPeriodEnd).toBe(true);
      expect(result.scheduledPlan).toBeDefined();
      expect(result.scheduledPlan!.slug).toBe('free');
      expect(mockStripeService.cancelSubscription).toHaveBeenCalledWith('sub_stripe_123');
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: {
          cancelAtPeriodEnd: true,
          scheduledPlanId: mockPlanFree.id,
          scheduledBillingInterval: null,
        },
        include: { plan: true, scheduledPlan: true },
      });
    });

    it('deve lançar NotFoundException quando não há assinatura ativa', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(null);

      await expect(service.downgrade('user-1', 'free')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.downgrade('user-1', 'free')).rejects.toThrow(
        'Nenhuma assinatura ativa encontrada',
      );
    });

    it('deve lançar BadRequestException quando plano de destino é o mesmo', async () => {
      const currentSub = buildSubscription(mockPlanStarter);
      mockPrisma.subscription.findFirst.mockResolvedValue(currentSub);
      mockPlansService.findPlanBySlug.mockResolvedValue(mockPlanStarter);

      await expect(service.downgrade('user-1', 'starter')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.downgrade('user-1', 'starter')).rejects.toThrow(
        'Você já está neste plano.',
      );
    });

    it('deve lançar BadRequestException quando plano de destino é superior (deve usar upgrade)', async () => {
      const currentSub = buildSubscription(mockPlanStarter);
      mockPrisma.subscription.findFirst.mockResolvedValue(currentSub);
      mockPlansService.findPlanBySlug.mockResolvedValue(mockPlanPro);

      await expect(service.downgrade('user-1', 'pro')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.downgrade('user-1', 'pro')).rejects.toThrow(
        'O plano "pro" não é inferior ao atual. Use upgrade.',
      );
    });

    it('deve lançar BadRequestException quando assinatura não tem externalSubscriptionId', async () => {
      const currentSub = buildSubscription(mockPlanPro, { externalSubscriptionId: null });
      mockPrisma.subscription.findFirst.mockResolvedValue(currentSub);
      mockPlansService.findPlanBySlug.mockResolvedValue(mockPlanStarter);

      await expect(service.downgrade('user-1', 'starter')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.downgrade('user-1', 'starter')).rejects.toThrow(
        'Assinatura sem vínculo com Stripe',
      );
    });

    it('deve falhar sem tocar no Stripe quando o plano de destino não tem preço na moeda', async () => {
      const currentSub = buildSubscription(mockPlanPro);
      mockPrisma.subscription.findFirst.mockResolvedValue(currentSub);
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({ currency: 'BRL' });
      mockPlansService.findPlanBySlug.mockResolvedValue(mockPlanStarter);
      mockPlansService.resolvePlanPrice.mockRejectedValueOnce(
        new NotFoundException('Preço não configurado para plano plan-starter em BRL ou USD'),
      );

      await expect(service.downgrade('user-1', 'starter')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockStripeService.scheduleSubscriptionPlanChange).not.toHaveBeenCalled();
      expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // cancel
  // ══════════════════════════════════════════════════════════════════

  describe('cancel', () => {
    it('deve cancelar assinatura marcando cancelAtPeriodEnd e limpando scheduledPlanId', async () => {
      const currentSub = buildSubscription(mockPlanStarter);
      mockPrisma.subscription.findFirst.mockResolvedValue(currentSub);
      mockStripeService.cancelSubscription.mockResolvedValue(undefined);
      const updatedSub = buildSubscription(mockPlanStarter, { cancelAtPeriodEnd: true });
      mockPrisma.subscription.update.mockResolvedValue(updatedSub);

      const result = await service.cancel('user-1');

      expect(result.cancelAtPeriodEnd).toBe(true);
      expect(mockStripeService.cancelSubscription).toHaveBeenCalledWith('sub_stripe_123');
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: { cancelAtPeriodEnd: true, scheduledPlanId: null, scheduledBillingInterval: null },
        include: { plan: true, scheduledPlan: true },
      });
    });

    it('deve reverter preço no Stripe quando há downgrade pago pendente antes de cancelar', async () => {
      const currentSub = buildSubscription(mockPlanPro, {
        scheduledPlanId: mockPlanStarter.id,
      });
      mockPrisma.subscription.findFirst.mockResolvedValue(currentSub);
      mockStripeService.scheduleSubscriptionPlanChange.mockResolvedValue(undefined);
      mockStripeService.cancelSubscription.mockResolvedValue(undefined);
      const updatedSub = buildSubscription(mockPlanPro, {
        cancelAtPeriodEnd: true,
        scheduledPlanId: null,
        scheduledPlan: null,
      });
      mockPrisma.subscription.update.mockResolvedValue(updatedSub);

      const result = await service.cancel('user-1');

      expect(result.cancelAtPeriodEnd).toBe(true);
      expect(result.scheduledPlan).toBeUndefined();
      // Deve reverter o preço do Stripe para o plano atual (Pro)
      expect(mockStripeService.scheduleSubscriptionPlanChange).toHaveBeenCalledWith(
        'sub_stripe_123',
        'price_pro_123',
      );
      // Depois cancelar no Stripe
      expect(mockStripeService.cancelSubscription).toHaveBeenCalledWith('sub_stripe_123');
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: { cancelAtPeriodEnd: true, scheduledPlanId: null, scheduledBillingInterval: null },
        include: { plan: true, scheduledPlan: true },
      });
    });

    it('não deve reverter preço no Stripe quando não há downgrade pendente', async () => {
      const currentSub = buildSubscription(mockPlanStarter);
      mockPrisma.subscription.findFirst.mockResolvedValue(currentSub);
      mockStripeService.cancelSubscription.mockResolvedValue(undefined);
      const updatedSub = buildSubscription(mockPlanStarter, { cancelAtPeriodEnd: true });
      mockPrisma.subscription.update.mockResolvedValue(updatedSub);

      await service.cancel('user-1');

      expect(mockStripeService.scheduleSubscriptionPlanChange).not.toHaveBeenCalled();
    });

    it('deve lançar NotFoundException quando não há assinatura ativa', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(null);

      await expect(service.cancel('user-1')).rejects.toThrow(NotFoundException);
      await expect(service.cancel('user-1')).rejects.toThrow(
        'Nenhuma assinatura ativa encontrada',
      );
    });

    it('deve lançar BadRequestException quando já está marcada para cancelamento', async () => {
      const currentSub = buildSubscription(mockPlanStarter, { cancelAtPeriodEnd: true });
      mockPrisma.subscription.findFirst.mockResolvedValue(currentSub);

      await expect(service.cancel('user-1')).rejects.toThrow(BadRequestException);
      await expect(service.cancel('user-1')).rejects.toThrow(
        'Assinatura já está marcada para cancelamento',
      );
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // reactivate
  // ══════════════════════════════════════════════════════════════════

  describe('reactivate', () => {
    it('deve reativar assinatura removendo cancelAtPeriodEnd e limpando scheduledPlanId', async () => {
      const currentSub = buildSubscription(mockPlanStarter, { cancelAtPeriodEnd: true });
      mockPrisma.subscription.findFirst.mockResolvedValue(currentSub);
      mockStripeService.reactivateSubscription.mockResolvedValue(undefined);
      const updatedSub = buildSubscription(mockPlanStarter, { cancelAtPeriodEnd: false });
      mockPrisma.subscription.update.mockResolvedValue(updatedSub);

      const result = await service.reactivate('user-1');

      expect(result.cancelAtPeriodEnd).toBe(false);
      expect(mockStripeService.reactivateSubscription).toHaveBeenCalledWith('sub_stripe_123');
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: { cancelAtPeriodEnd: false, scheduledPlanId: null, scheduledBillingInterval: null },
        include: { plan: true, scheduledPlan: true },
      });
    });

    it('deve reverter preço no Stripe quando há downgrade pendente ao reativar', async () => {
      const currentSub = buildSubscription(mockPlanPro, {
        cancelAtPeriodEnd: true,
        scheduledPlanId: mockPlanStarter.id,
      });
      mockPrisma.subscription.findFirst.mockResolvedValue(currentSub);
      mockStripeService.reactivateSubscription.mockResolvedValue(undefined);
      mockStripeService.scheduleSubscriptionPlanChange.mockResolvedValue(undefined);
      const updatedSub = buildSubscription(mockPlanPro, {
        cancelAtPeriodEnd: false,
        scheduledPlanId: null,
        scheduledPlan: null,
      });
      mockPrisma.subscription.update.mockResolvedValue(updatedSub);

      const result = await service.reactivate('user-1');

      expect(result.cancelAtPeriodEnd).toBe(false);
      // Deve reativar no Stripe
      expect(mockStripeService.reactivateSubscription).toHaveBeenCalledWith('sub_stripe_123');
      // Deve reverter o preço do Stripe para o plano atual (Pro)
      expect(mockStripeService.scheduleSubscriptionPlanChange).toHaveBeenCalledWith(
        'sub_stripe_123',
        'price_pro_123',
      );
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: { cancelAtPeriodEnd: false, scheduledPlanId: null, scheduledBillingInterval: null },
        include: { plan: true, scheduledPlan: true },
      });
    });

    it('não deve reverter preço no Stripe quando não há downgrade pendente', async () => {
      const currentSub = buildSubscription(mockPlanStarter, { cancelAtPeriodEnd: true });
      mockPrisma.subscription.findFirst.mockResolvedValue(currentSub);
      mockStripeService.reactivateSubscription.mockResolvedValue(undefined);
      const updatedSub = buildSubscription(mockPlanStarter, { cancelAtPeriodEnd: false });
      mockPrisma.subscription.update.mockResolvedValue(updatedSub);

      await service.reactivate('user-1');

      expect(mockStripeService.scheduleSubscriptionPlanChange).not.toHaveBeenCalled();
    });

    it('deve lançar NotFoundException quando não há assinatura com cancelamento pendente', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(null);

      await expect(service.reactivate('user-1')).rejects.toThrow(NotFoundException);
      await expect(service.reactivate('user-1')).rejects.toThrow(
        'Nenhuma assinatura ativa com cancelamento pendente encontrada',
      );
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // cancelDowngrade
  // ══════════════════════════════════════════════════════════════════

  describe('cancelDowngrade', () => {
    it('deve cancelar downgrade de plano pago revertendo preço no Stripe', async () => {
      const currentSub = buildSubscription(mockPlanPro, {
        scheduledPlanId: mockPlanStarter.id,
        scheduledPlan: mockPlanStarter,
      });
      mockPrisma.subscription.findFirst.mockResolvedValue(currentSub);
      mockStripeService.scheduleSubscriptionPlanChange.mockResolvedValue(undefined);
      const updatedSub = buildSubscription(mockPlanPro, {
        scheduledPlanId: null,
        scheduledPlan: null,
        cancelAtPeriodEnd: false,
      });
      mockPrisma.subscription.update.mockResolvedValue(updatedSub);

      const result = await service.cancelDowngrade('user-1');

      expect(result.plan.slug).toBe('pro');
      expect(result.scheduledPlan).toBeUndefined();
      expect(result.cancelAtPeriodEnd).toBe(false);
      // Deve reverter o preço no Stripe para o plano atual
      expect(mockStripeService.scheduleSubscriptionPlanChange).toHaveBeenCalledWith(
        'sub_stripe_123',
        'price_pro_123',
      );
      // Não deve chamar reactivateSubscription (não é downgrade para free)
      expect(mockStripeService.reactivateSubscription).not.toHaveBeenCalled();
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: { scheduledPlanId: null, scheduledBillingInterval: null, cancelAtPeriodEnd: false },
        include: { plan: true, scheduledPlan: true },
      });
    });

    it('deve cancelar downgrade para Free reativando no Stripe', async () => {
      const currentSub = buildSubscription(mockPlanStarter, {
        scheduledPlanId: mockPlanFree.id,
        scheduledPlan: mockPlanFree,
        cancelAtPeriodEnd: true,
      });
      mockPrisma.subscription.findFirst.mockResolvedValue(currentSub);
      mockStripeService.reactivateSubscription.mockResolvedValue(undefined);
      const updatedSub = buildSubscription(mockPlanStarter, {
        scheduledPlanId: null,
        scheduledPlan: null,
        cancelAtPeriodEnd: false,
      });
      mockPrisma.subscription.update.mockResolvedValue(updatedSub);

      const result = await service.cancelDowngrade('user-1');

      expect(result.plan.slug).toBe('starter');
      expect(result.scheduledPlan).toBeUndefined();
      expect(result.cancelAtPeriodEnd).toBe(false);
      // Deve reativar no Stripe (revert cancel_at_period_end)
      expect(mockStripeService.reactivateSubscription).toHaveBeenCalledWith('sub_stripe_123');
      // Não deve chamar scheduleSubscriptionPlanChange (cancelAtPeriodEnd was true)
      expect(mockStripeService.scheduleSubscriptionPlanChange).not.toHaveBeenCalled();
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: { scheduledPlanId: null, scheduledBillingInterval: null, cancelAtPeriodEnd: false },
        include: { plan: true, scheduledPlan: true },
      });
    });

    it('deve lançar NotFoundException quando não há downgrade agendado', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(null);

      await expect(service.cancelDowngrade('user-1')).rejects.toThrow(NotFoundException);
      await expect(service.cancelDowngrade('user-1')).rejects.toThrow(
        'Nenhum downgrade agendado encontrado',
      );
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // acceptOffer
  // ══════════════════════════════════════════════════════════════════

  describe('acceptOffer', () => {
    it('deve aplicar 15% OFF por 2 meses para reason "expensive"', async () => {
      const currentSub = buildSubscription(mockPlanStarter);
      mockPrisma.subscription.findFirst.mockResolvedValue(currentSub);
      mockPrisma.subscription.updateMany.mockResolvedValue({ count: 1 });
      mockStripeService.applyRetentionDiscount.mockResolvedValue(undefined);

      const result = await service.acceptOffer('user-1', 'expensive');

      expect(result).toEqual({
        offerType: 'discount',
        detail: '15% OFF por 2 meses aplicado',
      });
      expect(mockStripeService.applyRetentionDiscount).toHaveBeenCalledWith(
        'sub_stripe_123',
        15,
        2,
        'user-1',
        'expensive',
      );
      // Claim atomico via updateMany
      expect(mockPrisma.subscription.updateMany).toHaveBeenCalledWith({
        where: { id: 'sub-1', retentionOfferAcceptedAt: null },
        data: { retentionOfferAcceptedAt: expect.any(Date) },
      });
    });

    it('deve adicionar +50 créditos bonus para reason "not_using"', async () => {
      const currentSub = buildSubscription(mockPlanStarter);
      mockPrisma.subscription.findFirst.mockResolvedValue(currentSub);
      mockPrisma.subscription.updateMany.mockResolvedValue({ count: 1 });
      mockCreditsService.addBonusCredits.mockResolvedValue(undefined);

      const result = await service.acceptOffer('user-1', 'not_using');

      expect(result).toEqual({
        offerType: 'bonus_credits',
        detail: '+50 creditos bonus adicionados',
      });
      expect(mockCreditsService.addBonusCredits).toHaveBeenCalledWith(
        'user-1',
        50,
        'Bonus de retencao: +50 creditos para explorar a plataforma',
      );
    });

    it('deve adicionar +30 créditos bonus para reason "quality"', async () => {
      const currentSub = buildSubscription(mockPlanStarter);
      mockPrisma.subscription.findFirst.mockResolvedValue(currentSub);
      mockPrisma.subscription.updateMany.mockResolvedValue({ count: 1 });
      mockCreditsService.addBonusCredits.mockResolvedValue(undefined);

      const result = await service.acceptOffer('user-1', 'quality');

      expect(result).toEqual({
        offerType: 'bonus_credits',
        detail: '+30 creditos bonus adicionados',
      });
      expect(mockCreditsService.addBonusCredits).toHaveBeenCalledWith(
        'user-1',
        30,
        'Bonus de retencao: +30 creditos para testar melhorias',
      );
    });

    it('deve adicionar +100 créditos bonus para reason "competitor"', async () => {
      const currentSub = buildSubscription(mockPlanStarter);
      mockPrisma.subscription.findFirst.mockResolvedValue(currentSub);
      mockPrisma.subscription.updateMany.mockResolvedValue({ count: 1 });
      mockCreditsService.addBonusCredits.mockResolvedValue(undefined);

      const result = await service.acceptOffer('user-1', 'competitor');

      expect(result).toEqual({
        offerType: 'bonus_credits',
        detail: '+100 creditos bonus adicionados',
      });
      expect(mockCreditsService.addBonusCredits).toHaveBeenCalledWith(
        'user-1',
        100,
        'Bonus de retencao: +100 creditos para comparar com concorrentes',
      );
    });

    it('deve pausar assinatura para reason "temporary"', async () => {
      const currentSub = buildSubscription(mockPlanStarter);
      // findFirst é chamado 2x: uma no acceptOffer e outra no pause()
      mockPrisma.subscription.findFirst
        .mockResolvedValueOnce(currentSub)   // acceptOffer
        .mockResolvedValueOnce(currentSub);  // pause()
      mockPrisma.subscription.updateMany.mockResolvedValue({ count: 1 });
      mockStripeService.pauseSubscription.mockResolvedValue(undefined);
      const pausedSub = buildSubscription(mockPlanStarter, { pausedUntil: new Date() });
      mockPrisma.subscription.update.mockResolvedValue(pausedSub);

      const result = await service.acceptOffer('user-1', 'temporary');

      expect(result).toEqual({
        offerType: 'pause',
        detail: 'Assinatura pausada por 30 dias',
      });
    });

    it('deve aplicar 20% OFF na próxima renovação para reason desconhecido (default)', async () => {
      const currentSub = buildSubscription(mockPlanStarter);
      mockPrisma.subscription.findFirst.mockResolvedValue(currentSub);
      mockPrisma.subscription.updateMany.mockResolvedValue({ count: 1 });
      mockStripeService.applyRetentionDiscount.mockResolvedValue(undefined);

      const result = await service.acceptOffer('user-1', 'other_reason');

      expect(result).toEqual({
        offerType: 'discount',
        detail: '20% OFF na proxima renovacao aplicado',
      });
      expect(mockStripeService.applyRetentionDiscount).toHaveBeenCalledWith(
        'sub_stripe_123',
        20,
        1,
        'user-1',
        'other_reason',
      );
    });

    it('deve bloquear oferta se já aceitou uma nesta assinatura', async () => {
      const currentSub = buildSubscription(mockPlanStarter, {
        retentionOfferAcceptedAt: new Date('2026-03-15'),
      });
      mockPrisma.subscription.findFirst.mockResolvedValue(currentSub);

      await expect(service.acceptOffer('user-1', 'expensive')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.acceptOffer('user-1', 'expensive')).rejects.toThrow(
        'Voce ja aceitou uma oferta de retencao nesta assinatura.',
      );
    });

    it('deve bloquear oferta via updateMany quando race condition (claim count = 0)', async () => {
      const currentSub = buildSubscription(mockPlanStarter);
      mockPrisma.subscription.findFirst.mockResolvedValue(currentSub);
      // Simula race condition: in-memory check passa mas updateMany retorna 0
      mockPrisma.subscription.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.acceptOffer('user-1', 'expensive')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.acceptOffer('user-1', 'expensive')).rejects.toThrow(
        'Voce ja aceitou uma oferta de retencao nesta assinatura.',
      );
    });

    it('deve bloquear oferta em assinatura marcada para cancelamento', async () => {
      const currentSub = buildSubscription(mockPlanStarter, {
        cancelAtPeriodEnd: true,
      });
      mockPrisma.subscription.findFirst.mockResolvedValue(currentSub);

      await expect(service.acceptOffer('user-1', 'expensive')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.acceptOffer('user-1', 'expensive')).rejects.toThrow(
        'Nao e possivel aceitar oferta em assinatura marcada para cancelamento.',
      );
    });

    it('deve bloquear oferta em assinatura pausada', async () => {
      const currentSub = buildSubscription(mockPlanStarter, {
        pausedUntil: new Date('2026-04-15'),
      });
      mockPrisma.subscription.findFirst.mockResolvedValue(currentSub);

      await expect(service.acceptOffer('user-1', 'expensive')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.acceptOffer('user-1', 'expensive')).rejects.toThrow(
        'Nao e possivel aceitar oferta em assinatura pausada.',
      );
    });

    it('deve fazer rollback do claim se aplicacao da oferta falhar', async () => {
      const currentSub = buildSubscription(mockPlanStarter, {
        externalSubscriptionId: null,
      });
      mockPrisma.subscription.findFirst.mockResolvedValue(currentSub);
      mockPrisma.subscription.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.subscription.update.mockResolvedValue(currentSub);

      await expect(service.acceptOffer('user-1', 'expensive')).rejects.toThrow(
        BadRequestException,
      );
      // Deve fazer rollback limpando retentionOfferAcceptedAt
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: { retentionOfferAcceptedAt: null },
      });
    });

    it('deve lançar NotFoundException quando não há assinatura ativa', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(null);

      await expect(service.acceptOffer('user-1', 'expensive')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deve lançar BadRequestException para plano Free', async () => {
      const currentSub = buildSubscription(mockPlanFree);
      mockPrisma.subscription.findFirst.mockResolvedValue(currentSub);

      await expect(service.acceptOffer('user-1', 'expensive')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.acceptOffer('user-1', 'expensive')).rejects.toThrow(
        'Plano Free nao possui ofertas de retencao',
      );
    });
  });
  // ══════════════════════════════════════════════════════════════════
  // PLANO ANUAL
  // ══════════════════════════════════════════════════════════════════

  describe('plano anual', () => {
    const yearlyPro = annualPriceFromMonthly(mockPlanPro.priceCents); // 86304
    const yearlyStarter = annualPriceFromMonthly(mockPlanStarter.priceCents); // 28704

    beforeEach(() => {
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({ ...mockUser, currency: 'BRL', taxId: '12345678909' });
      mockStripeService.getOrCreateCustomer.mockResolvedValue('cus_123');
      mockStripeService.createSubscriptionCheckout.mockResolvedValue('https://checkout.stripe.com/annual');
      mockStripeService.getSubscriptionDiscount.mockResolvedValue(null);
    });

    describe('createSubscription', () => {
      it('YEARLY usa o price anual e marca o ciclo no checkout', async () => {
        mockPlansService.findPlanBySlug.mockResolvedValue(mockPlanPro);
        mockPrisma.subscription.findFirst.mockResolvedValue(null);

        await service.createSubscription('user-1', 'pro', undefined, undefined, 'YEARLY');

        expect(mockPlansService.resolvePlanPrice).toHaveBeenCalledWith('plan-pro', 'BRL', 'YEARLY');
        const args = mockStripeService.createSubscriptionCheckout.mock.calls[0];
        expect(args[3]).toBe(yearlyPro);
        expect(args[5]).toBe('price_pro_123_yearly');
        expect(args[11]).toBe('YEARLY');
      });
    });

    describe('upgrade', () => {
      it('mensal → anual no mesmo plano: vale na hora, crédito = mensalidade paga', async () => {
        mockPrisma.subscription.findFirst.mockResolvedValue(buildSubscription(mockPlanPro));
        mockPlansService.findPlanBySlug.mockResolvedValue(mockPlanPro);

        await service.upgrade('user-1', 'pro', undefined, 'YEARLY');

        const args = mockStripeService.createSubscriptionCheckout.mock.calls[0];
        expect(args[5]).toBe('price_pro_123_yearly');
        expect(args[7]).toBe(mockPlanPro.priceCents); // crédito
        expect(args[8]).toBe('sub_stripe_123'); // antiga é cancelada no webhook
        expect(args[11]).toBe('YEARLY');
      });

      it('anual → anual superior: crédito proporcional ao que falta do ano', async () => {
        jest.useFakeTimers({ now: new Date('2026-07-02T12:00:00Z') });
        try {
          const start = new Date('2026-01-01T12:00:00Z');
          const end = new Date('2027-01-01T12:00:00Z');
          mockPrisma.subscription.findFirst.mockResolvedValue(
            buildSubscription(mockPlanStarter, {
              billingInterval: 'YEARLY',
              currentPeriodStart: start,
              currentPeriodEnd: end,
            }),
          );
          mockPlansService.findPlanBySlug.mockResolvedValue(mockPlanPro);
          mockPrisma.payment.findFirst.mockResolvedValue({ amountCents: yearlyStarter, metadata: null });

          await service.upgrade('user-1', 'pro', undefined, 'YEARLY');

          const remaining = end.getTime() - Date.now();
          const total = end.getTime() - start.getTime();
          const expectedCredit = Math.floor((yearlyStarter * remaining) / total);
          const args = mockStripeService.createSubscriptionCheckout.mock.calls[0];
          expect(args[7]).toBe(expectedCredit);
          expect(expectedCredit).toBeGreaterThan(0);
          expect(expectedCredit).toBeLessThan(yearlyStarter);
          expect(mockPrisma.payment.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
              where: { subscriptionId: 'sub-1', type: 'SUBSCRIPTION', status: 'COMPLETED' },
            }),
          );
        } finally {
          jest.useRealTimers();
        }
      });

      it('anual: soma o crédito de upgrade abatido no pagamento, limitado ao preço de tabela', async () => {
        const start = new Date();
        const end = new Date(start.getTime() + 365 * 86_400_000);
        mockPrisma.subscription.findFirst.mockResolvedValue(
          buildSubscription(mockPlanStarter, {
            billingInterval: 'YEARLY',
            currentPeriodStart: start,
            currentPeriodEnd: end,
          }),
        );
        mockPlansService.findPlanBySlug.mockResolvedValue(mockPlanPro);
        // Pagou 20000 + 9000 de crédito = 29000 > 28704 (tabela) → limita em 28704
        mockPrisma.payment.findFirst.mockResolvedValue({
          amountCents: 20000,
          metadata: { upgradeCreditCents: 9000 },
        });

        await service.upgrade('user-1', 'pro', undefined, 'YEARLY');

        const credit = mockStripeService.createSubscriptionCheckout.mock.calls[0][7];
        expect(credit).toBeLessThanOrEqual(yearlyStarter);
        expect(credit).toBeGreaterThan(yearlyStarter - 200); // quase o ano todo
      });

      it('sem billingInterval mantém o ciclo atual (front antigo)', async () => {
        mockPrisma.subscription.findFirst.mockResolvedValue(
          buildSubscription(mockPlanStarter, { billingInterval: 'YEARLY' }),
        );
        mockPlansService.findPlanBySlug.mockResolvedValue(mockPlanPro);

        await service.upgrade('user-1', 'pro');

        expect(mockStripeService.createSubscriptionCheckout.mock.calls[0][11]).toBe('YEARLY');
      });

      it('anual → mensal não é upgrade: 400 orientando agendar', async () => {
        mockPrisma.subscription.findFirst.mockResolvedValue(
          buildSubscription(mockPlanStarter, { billingInterval: 'YEARLY' }),
        );
        mockPlansService.findPlanBySlug.mockResolvedValue(mockPlanStudio);

        await expect(
          service.upgrade('user-1', 'studio', undefined, 'MONTHLY'),
        ).rejects.toThrow('Essa troca de plano só vale na renovação');
        expect(mockStripeService.createSubscriptionCheckout).not.toHaveBeenCalled();
      });

      it('assinatura TRIALING (PIX não pago) não gera crédito', async () => {
        mockPrisma.subscription.findFirst.mockResolvedValue(
          buildSubscription(mockPlanStarter, { status: 'TRIALING' }),
        );
        mockPlansService.findPlanBySlug.mockResolvedValue(mockPlanPro);

        await service.upgrade('user-1', 'pro');

        expect(mockStripeService.createSubscriptionCheckout.mock.calls[0][7]).toBeUndefined();
      });
    });

    describe('downgrade (troca agendada)', () => {
      it('anual → mensal no mesmo plano: schedule no fim do período, sem cobrar agora', async () => {
        mockPrisma.subscription.findFirst.mockResolvedValue(
          buildSubscription(mockPlanPro, { billingInterval: 'YEARLY' }),
        );
        mockPlansService.findPlanBySlug.mockResolvedValue(mockPlanPro);
        mockPrisma.subscription.update.mockResolvedValue(
          buildSubscription(mockPlanPro, {
            billingInterval: 'YEARLY',
            scheduledPlanId: 'plan-pro',
            scheduledBillingInterval: 'MONTHLY',
          }),
        );

        const result = await service.downgrade('user-1', 'pro', 'MONTHLY');

        expect(mockStripeService.scheduleSubscriptionChangeAtPeriodEnd).toHaveBeenCalledWith(
          'sub_stripe_123',
          'price_pro_123',
          'MONTHLY',
        );
        expect(mockStripeService.scheduleSubscriptionPlanChange).not.toHaveBeenCalled();
        expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: { scheduledPlanId: 'plan-pro', scheduledBillingInterval: 'MONTHLY' },
          }),
        );
        expect(result.billingInterval).toBe('YEARLY');
        expect(result.scheduledBillingInterval).toBe('MONTHLY');
      });

      it('anual → anual inferior: troca o price anual sem proration', async () => {
        mockPrisma.subscription.findFirst.mockResolvedValue(
          buildSubscription(mockPlanPro, { billingInterval: 'YEARLY' }),
        );
        mockPlansService.findPlanBySlug.mockResolvedValue(mockPlanStarter);
        mockPrisma.subscription.update.mockResolvedValue(buildSubscription(mockPlanPro));

        await service.downgrade('user-1', 'starter');

        expect(mockStripeService.scheduleSubscriptionPlanChange).toHaveBeenCalledWith(
          'sub_stripe_123',
          'price_starter_123_yearly',
        );
        expect(mockStripeService.scheduleSubscriptionChangeAtPeriodEnd).not.toHaveBeenCalled();
      });

      it('mensal → anual inferior: agenda via schedule', async () => {
        mockPrisma.subscription.findFirst.mockResolvedValue(buildSubscription(mockPlanPro));
        mockPlansService.findPlanBySlug.mockResolvedValue(mockPlanStarter);
        mockPrisma.subscription.update.mockResolvedValue(buildSubscription(mockPlanPro));

        await service.downgrade('user-1', 'starter', 'YEARLY');

        expect(mockStripeService.scheduleSubscriptionChangeAtPeriodEnd).toHaveBeenCalledWith(
          'sub_stripe_123',
          'price_starter_123_yearly',
          'YEARLY',
        );
      });

      it('mensal → anual no mesmo plano não é downgrade (é upgrade)', async () => {
        mockPrisma.subscription.findFirst.mockResolvedValue(buildSubscription(mockPlanPro));
        mockPlansService.findPlanBySlug.mockResolvedValue(mockPlanPro);

        await expect(service.downgrade('user-1', 'pro', 'YEARLY')).rejects.toThrow(
          BadRequestException,
        );
        expect(mockStripeService.scheduleSubscriptionChangeAtPeriodEnd).not.toHaveBeenCalled();
      });

      it('cancelar troca de ciclo agendada solta o schedule e não troca price', async () => {
        mockPrisma.subscription.findFirst.mockResolvedValue(
          buildSubscription(mockPlanPro, {
            billingInterval: 'YEARLY',
            scheduledPlanId: 'plan-pro',
            scheduledBillingInterval: 'MONTHLY',
          }),
        );
        mockStripeService.releaseSubscriptionSchedule.mockResolvedValue(true);
        mockPrisma.subscription.update.mockResolvedValue(
          buildSubscription(mockPlanPro, { billingInterval: 'YEARLY' }),
        );

        await service.cancelDowngrade('user-1');

        expect(mockStripeService.releaseSubscriptionSchedule).toHaveBeenCalledWith('sub_stripe_123');
        expect(mockStripeService.scheduleSubscriptionPlanChange).not.toHaveBeenCalled();
      });

      it('cancelar assinatura anual com troca de ciclo agendada solta o schedule antes', async () => {
        mockPrisma.subscription.findFirst.mockResolvedValue(
          buildSubscription(mockPlanPro, {
            billingInterval: 'YEARLY',
            scheduledPlanId: 'plan-pro',
            scheduledBillingInterval: 'MONTHLY',
          }),
        );
        mockStripeService.releaseSubscriptionSchedule.mockResolvedValue(true);
        mockPrisma.subscription.update.mockResolvedValue(
          buildSubscription(mockPlanPro, { billingInterval: 'YEARLY', cancelAtPeriodEnd: true }),
        );

        await service.cancel('user-1');

        expect(mockStripeService.releaseSubscriptionSchedule).toHaveBeenCalled();
        expect(mockStripeService.scheduleSubscriptionPlanChange).not.toHaveBeenCalled();
        expect(mockStripeService.cancelSubscription).toHaveBeenCalledWith('sub_stripe_123');
      });
    });

    describe('retenção e pausa', () => {
      it('pause rejeita plano anual', async () => {
        mockPrisma.subscription.findFirst.mockResolvedValue(
          buildSubscription(mockPlanPro, { billingInterval: 'YEARLY' }),
        );

        await expect(service.pause('user-1')).rejects.toThrow(
          'Não é possível pausar o plano anual.',
        );
        expect(mockStripeService.pauseSubscription).not.toHaveBeenCalled();
      });

      it.each(['expensive', 'temporary', 'other'])(
        'acceptOffer(%s) rejeita no anual sem marcar a oferta',
        async (reason) => {
          mockPrisma.subscription.findFirst.mockResolvedValue(
            buildSubscription(mockPlanPro, { billingInterval: 'YEARLY' }),
          );

          await expect(service.acceptOffer('user-1', reason)).rejects.toThrow(
            'Ofertas de desconto e pausa não se aplicam ao plano anual.',
          );
          expect(mockPrisma.subscription.updateMany).not.toHaveBeenCalled();
          expect(mockStripeService.applyRetentionDiscount).not.toHaveBeenCalled();
        },
      );

      it('acceptOffer de créditos bônus continua valendo no anual', async () => {
        mockPrisma.subscription.findFirst.mockResolvedValue(
          buildSubscription(mockPlanPro, { billingInterval: 'YEARLY' }),
        );
        mockPrisma.subscription.updateMany.mockResolvedValue({ count: 1 });

        const result = await service.acceptOffer('user-1', 'not_using');

        expect(result.offerType).toBe('bonus_credits');
        expect(mockCreditsService.addBonusCredits).toHaveBeenCalled();
      });
    });

    describe('PIX Automático anual', () => {
      const authorization = {
        id: 'auth-1',
        status: 'PENDING',
        qrCodePayload: 'pix-payload',
        qrCodeEncodedImage: 'data:image/png;base64,xx',
        conciliationIdentifier: '',
        value: 0,
        expiresAt: null,
      };

      beforeEach(() => {
        mockPlansService.findPlanBySlug.mockResolvedValue(mockPlanPro);
        mockAsaasService.getOrCreateCustomer.mockResolvedValue('cus_asaas_1');
        mockAsaasSubscriptionsService.createAuthorization.mockResolvedValue(authorization);
        mockPrisma.subscription.create.mockResolvedValue({ id: 'sub-pix' });
      });

      it('nova assinatura anual: frequency ANNUALLY, valor anual e contrato próprio', async () => {
        jest.useFakeTimers({ now: new Date(2026, 4, 10, 12) });
        try {
          mockPrisma.subscription.findFirst.mockResolvedValue(null);

          const result = await service.createPixAutoSubscription('user-1', 'pro', undefined, 'YEARLY');

          expect(mockPlansService.resolvePlanPrice).toHaveBeenCalledWith('plan-pro', 'BRL', 'YEARLY');
          const input = mockAsaasSubscriptionsService.createAuthorization.mock.calls[0][0];
          expect(input.frequency).toBe('ANNUALLY');
          expect(input.valueCents).toBe(yearlyPro);
          expect(input.immediateValueCents).toBeUndefined();
          expect(input.contractId).toMatch(/-pro-a$/);
          expect(input.description).toBe('Geraew Pro anual');

          const created = mockPrisma.subscription.create.mock.calls[0][0].data;
          expect(created.billingInterval).toBe('YEARLY');
          expect(created.status).toBe('TRIALING');
          expect(created.currentPeriodEnd).toEqual(new Date(2027, 4, 10, 12));

          expect(result).toEqual(
            expect.objectContaining({
              billingInterval: 'YEARLY',
              immediateValueCents: yearlyPro,
              recurringValueCents: yearlyPro,
              isUpgrade: false,
            }),
          );
        } finally {
          jest.useRealTimers();
        }
      });

      it('mensal PIX → anual no mesmo plano: paga agora o anual menos a mensalidade', async () => {
        mockPrisma.subscription.findFirst.mockResolvedValue(
          buildSubscription(mockPlanPro, {
            paymentMethod: 'pix_auto_asaas',
            externalSubscriptionId: null,
            asaasAuthorizationId: 'auth-old',
            asaasAuthorizationStatus: 'ACTIVE',
          }),
        );

        const result = await service.createPixAutoSubscription('user-1', 'pro', undefined, 'YEARLY');

        const input = mockAsaasSubscriptionsService.createAuthorization.mock.calls[0][0];
        expect(input.frequency).toBe('ANNUALLY');
        expect(input.valueCents).toBe(yearlyPro);
        expect(input.immediateValueCents).toBe(yearlyPro - mockPlanPro.priceCents);
        expect(result.isUpgrade).toBe(true);
        // A antiga só é cancelada quando a nova autorização for ativada
        expect(mockAsaasSubscriptionsService.cancelAuthorization).not.toHaveBeenCalled();
      });

      it('anual PIX → mensal continua bloqueado (Conflict)', async () => {
        mockPrisma.subscription.findFirst.mockResolvedValue(
          buildSubscription(mockPlanPro, {
            billingInterval: 'YEARLY',
            paymentMethod: 'pix_auto_asaas',
            externalSubscriptionId: null,
            asaasAuthorizationStatus: 'ACTIVE',
          }),
        );

        await expect(
          service.createPixAutoSubscription('user-1', 'studio', undefined, 'MONTHLY'),
        ).rejects.toThrow(ConflictException);
        expect(mockAsaasSubscriptionsService.createAuthorization).not.toHaveBeenCalled();
      });

      it('sem ciclo continua mensal (MONTHLY, sem sufixo no contrato)', async () => {
        mockPrisma.subscription.findFirst.mockResolvedValue(null);

        await service.createPixAutoSubscription('user-1', 'pro');

        const input = mockAsaasSubscriptionsService.createAuthorization.mock.calls[0][0];
        expect(input.frequency).toBe('MONTHLY');
        expect(input.valueCents).toBe(mockPlanPro.priceCents);
        expect(input.contractId).toMatch(/-pro$/);
      });
    });

    it('getCurrentSubscription expõe billingInterval e scheduledBillingInterval', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(
        buildSubscription(mockPlanPro, {
          billingInterval: 'YEARLY',
          scheduledBillingInterval: 'MONTHLY',
        }),
      );

      const result = await service.getCurrentSubscription('user-1');

      expect(result!.billingInterval).toBe('YEARLY');
      expect(result!.scheduledBillingInterval).toBe('MONTHLY');
    });
  });
});
