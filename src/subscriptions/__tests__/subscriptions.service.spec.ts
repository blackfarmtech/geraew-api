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
  },
  user: {
    findUniqueOrThrow: jest.fn(),
  },
};

const mockPlansService = {
  findPlanBySlug: jest.fn(),
};

const mockStripeService = {
  getOrCreateCustomer: jest.fn(),
  createSubscriptionCheckout: jest.fn(),
  cancelSubscription: jest.fn(),
  reactivateSubscription: jest.fn(),
  scheduleSubscriptionPlanChange: jest.fn(),
};

// ── Test Suite ───────────────────────────────────────────────────────

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PlansService, useValue: mockPlansService },
        { provide: StripeService, useValue: mockStripeService },
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
        include: { plan: true },
      });
    });

    it('deve retornar DTO da assinatura quando existe', async () => {
      const subscription = buildSubscription(mockPlanStarter);
      mockPrisma.subscription.findFirst.mockResolvedValue(subscription);

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
        undefined,
      );
      // Não deve tentar cancelar no Stripe pois externalSubscriptionId é null
      expect(mockStripeService.cancelSubscription).not.toHaveBeenCalled();
    });

    it('deve fazer upgrade de Starter para Pro com desconto do preço do Starter', async () => {
      const currentSub = buildSubscription(mockPlanStarter);
      mockPrisma.subscription.findFirst.mockResolvedValue(currentSub);
      mockPlansService.findPlanBySlug
        .mockResolvedValueOnce(mockPlanPro) // chamada no upgrade()
        .mockResolvedValueOnce(mockPlanPro); // chamada no buildCheckoutForPlan()
      mockPrisma.subscription.update.mockResolvedValue({ ...currentSub, cancelAtPeriodEnd: true });
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue(mockUser);
      mockStripeService.getOrCreateCustomer.mockResolvedValue('cus_123');
      mockStripeService.cancelSubscription.mockResolvedValue(undefined);
      mockStripeService.createSubscriptionCheckout.mockResolvedValue('https://checkout.stripe.com/upgrade_pro');

      const result = await service.upgrade('user-1', 'pro');

      expect(result).toEqual({ checkoutUrl: 'https://checkout.stripe.com/upgrade_pro' });
      // Starter -> Pro: desconto = priceCents do Starter (2990)
      expect(mockStripeService.createSubscriptionCheckout).toHaveBeenCalledWith(
        'cus_123',
        'pro',
        'Pro',
        8990,
        'user-1',
        'price_pro_123',
        2990,
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

    it('deve cancelar assinatura antiga no Stripe e marcar cancelAtPeriodEnd', async () => {
      const currentSub = buildSubscription(mockPlanStarter);
      mockPrisma.subscription.findFirst.mockResolvedValue(currentSub);
      mockPlansService.findPlanBySlug.mockResolvedValue(mockPlanPro);
      mockPrisma.subscription.update.mockResolvedValue({ ...currentSub, cancelAtPeriodEnd: true });
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue(mockUser);
      mockStripeService.getOrCreateCustomer.mockResolvedValue('cus_123');
      mockStripeService.cancelSubscription.mockResolvedValue(undefined);
      mockStripeService.createSubscriptionCheckout.mockResolvedValue('https://checkout.stripe.com/session');

      await service.upgrade('user-1', 'pro');

      expect(mockStripeService.cancelSubscription).toHaveBeenCalledWith('sub_stripe_123');
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: { cancelAtPeriodEnd: true },
      });
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
        undefined,
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
        data: { scheduledPlanId: mockPlanStarter.id },
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
        data: { cancelAtPeriodEnd: true, scheduledPlanId: mockPlanFree.id },
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

    it('deve lançar BadRequestException quando plano de destino não tem stripePriceId', async () => {
      const currentSub = buildSubscription(mockPlanPro);
      mockPrisma.subscription.findFirst.mockResolvedValue(currentSub);
      const planWithoutPrice = { ...mockPlanStarter, stripePriceId: null };
      mockPlansService.findPlanBySlug.mockResolvedValue(planWithoutPrice);

      await expect(service.downgrade('user-1', 'starter')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.downgrade('user-1', 'starter')).rejects.toThrow(
        'Plano de destino sem price ID no Stripe',
      );
    });
  });

  // ══════════════════════════════════════════════════════════════════
  // cancel
  // ══════════════════════════════════════════════════════════════════

  describe('cancel', () => {
    it('deve cancelar assinatura marcando cancelAtPeriodEnd', async () => {
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
        data: { cancelAtPeriodEnd: true },
        include: { plan: true },
      });
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
    it('deve reativar assinatura removendo cancelAtPeriodEnd', async () => {
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
        data: { cancelAtPeriodEnd: false },
        include: { plan: true },
      });
    });

    it('deve lançar NotFoundException quando não há assinatura com cancelamento pendente', async () => {
      mockPrisma.subscription.findFirst.mockResolvedValue(null);

      await expect(service.reactivate('user-1')).rejects.toThrow(NotFoundException);
      await expect(service.reactivate('user-1')).rejects.toThrow(
        'Nenhuma assinatura ativa com cancelamento pendente encontrada',
      );
    });
  });
});
