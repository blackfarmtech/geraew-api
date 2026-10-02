import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PlansService } from '../plans.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { GenerationType, Resolution } from '@prisma/client';

// ── Fixtures ─────────────────────────────────────────────────────────

const mockPlan = {
  id: 'plan-1',
  slug: 'starter',
  name: 'Starter',
  description: 'Starter plan',
  priceCents: 2990,
  creditsPerMonth: 10000,
  maxConcurrentGenerations: 2,
  hasWatermark: false,
  galleryRetentionDays: null,
  isActive: true,
  sortOrder: 1,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockCreditCost = {
  id: 'cost-1',
  generationType: 'TEXT_TO_IMAGE' as GenerationType,
  resolution: '_1K' as Resolution,
  hasAudio: false,
  creditsPerUnit: 100,
  isPerSecond: false,
  isActive: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockVideoCreditCost = {
  id: 'cost-2',
  generationType: 'TEXT_TO_VIDEO' as GenerationType,
  resolution: '_1080P' as Resolution,
  hasAudio: false,
  creditsPerUnit: 480,
  isPerSecond: true,
  isActive: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockCreditPackage = {
  id: 'pkg-1',
  name: 'Pacote 500',
  credits: 5000,
  priceCents: 1790,
  isActive: true,
  sortOrder: 0,
  createdAt: new Date('2026-01-01'),
};

// ── Mocks ────────────────────────────────────────────────────────────

const mockPrisma = {
  plan: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  creditCost: {
    findFirst: jest.fn(),
  },
  creditPackage: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  planPrice: {
    findUnique: jest.fn(),
  },
};

// Sem override de price por env nos testes.
const mockConfig = { get: jest.fn().mockReturnValue(undefined) };

// ── Test Suite ───────────────────────────────────────────────────────

describe('PlansService', () => {
  let service: PlansService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlansService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<PlansService>(PlansService);
  });

  // ────────────────────── findAllPlans ──────────────────────

  describe('findAllPlans', () => {
    it('should return all active plans ordered by sortOrder', async () => {
      const plans = [mockPlan, { ...mockPlan, id: 'plan-2', slug: 'pro', sortOrder: 2 }];
      mockPrisma.plan.findMany.mockResolvedValue(plans);

      const result = await service.findAllPlans();

      expect(result).toEqual(plans);
      expect(mockPrisma.plan.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      });
    });

    it('should return empty array when no plans exist', async () => {
      mockPrisma.plan.findMany.mockResolvedValue([]);

      const result = await service.findAllPlans();

      expect(result).toEqual([]);
    });
  });

  // ────────────────────── findPlanBySlug ──────────────────────

  describe('findPlanBySlug', () => {
    it('should return plan for valid slug', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(mockPlan);

      const result = await service.findPlanBySlug('starter');

      expect(result).toEqual(mockPlan);
      expect(mockPrisma.plan.findUnique).toHaveBeenCalledWith({
        where: { slug: 'starter' },
      });
    });

    it('should throw NotFoundException for invalid slug', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(null);

      await expect(service.findPlanBySlug('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findPlanBySlug('nonexistent')).rejects.toThrow(
        'Plano "nonexistent" não encontrado',
      );
    });
  });

  // ────────────────────── findPlanById ──────────────────────

  describe('findPlanById', () => {
    it('should return plan for valid id', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(mockPlan);

      const result = await service.findPlanById('plan-1');

      expect(result).toEqual(mockPlan);
      expect(mockPrisma.plan.findUnique).toHaveBeenCalledWith({
        where: { id: 'plan-1' },
      });
    });

    it('should throw NotFoundException for invalid id', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(null);

      await expect(service.findPlanById('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findPlanById('invalid-id')).rejects.toThrow(
        'Plano não encontrado',
      );
    });
  });

  // ────────────────────── getCreditCost ──────────────────────

  describe('getCreditCost', () => {
    it('should return credit cost for valid params', async () => {
      mockPrisma.creditCost.findFirst.mockResolvedValue(mockCreditCost);

      const result = await service.getCreditCost(
        'TEXT_TO_IMAGE' as GenerationType,
        '_1K' as Resolution,
        false,
      );

      expect(result).toEqual(mockCreditCost);
      expect(mockPrisma.creditCost.findFirst).toHaveBeenCalledWith({
        where: {
          generationType: 'TEXT_TO_IMAGE',
          resolution: '_1K',
          hasAudio: false,
          // Tipos de imagem sem variante caem no NB2 (todas as linhas de imagem têm variante).
          modelVariant: 'NB2',
          isActive: true,
        },
      });
    });

    it('should throw NotFoundException for unknown combination', async () => {
      mockPrisma.creditCost.findFirst.mockResolvedValue(null);

      await expect(
        service.getCreditCost(
          'TEXT_TO_IMAGE' as GenerationType,
          '_4K' as Resolution,
          true,
        ),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.getCreditCost(
          'TEXT_TO_IMAGE' as GenerationType,
          '_4K' as Resolution,
          true,
        ),
      ).rejects.toThrow(
        'Custo de crédito não encontrado para TEXT_TO_IMAGE _4K (audio: true, variant: default)',
      );
    });
  });

  // ────────────────────── calculateGenerationCost ──────────────────────

  describe('calculateGenerationCost', () => {
    it('should return creditsPerUnit for image (not per second)', async () => {
      mockPrisma.creditCost.findFirst.mockResolvedValue(mockCreditCost);

      const result = await service.calculateGenerationCost(
        'TEXT_TO_IMAGE' as GenerationType,
        '_1K' as Resolution,
      );

      expect(result).toBe(100);
    });

    it('should return creditsPerUnit * durationSeconds for video (per second)', async () => {
      mockPrisma.creditCost.findFirst.mockResolvedValue(mockVideoCreditCost);

      const result = await service.calculateGenerationCost(
        'TEXT_TO_VIDEO' as GenerationType,
        '_1080P' as Resolution,
        5,
        false,
      );

      expect(result).toBe(2400); // 480 * 5
    });

    it('should return creditsPerUnit when isPerSecond but no duration provided', async () => {
      mockPrisma.creditCost.findFirst.mockResolvedValue(mockVideoCreditCost);

      const result = await service.calculateGenerationCost(
        'TEXT_TO_VIDEO' as GenerationType,
        '_1080P' as Resolution,
        undefined,
        false,
      );

      expect(result).toBe(480);
    });
  });

  // ────────────────────── findAllPackages ──────────────────────

  describe('findAllPackages', () => {
    it('should return all active credit packages', async () => {
      const packages = [mockCreditPackage];
      mockPrisma.creditPackage.findMany.mockResolvedValue(packages);

      const result = await service.findAllPackages();

      expect(result).toEqual(packages);
      expect(mockPrisma.creditPackage.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      });
    });

    it('should return empty array when no packages exist', async () => {
      mockPrisma.creditPackage.findMany.mockResolvedValue([]);

      const result = await service.findAllPackages();

      expect(result).toEqual([]);
    });
  });

  // ────────────────────── findPackageById ──────────────────────

  describe('findPackageById', () => {
    it('should return package for valid id', async () => {
      mockPrisma.creditPackage.findUnique.mockResolvedValue(mockCreditPackage);

      const result = await service.findPackageById('pkg-1');

      expect(result).toEqual(mockCreditPackage);
      expect(mockPrisma.creditPackage.findUnique).toHaveBeenCalledWith({
        where: { id: 'pkg-1' },
      });
    });

    it('should throw NotFoundException for invalid id', async () => {
      mockPrisma.creditPackage.findUnique.mockResolvedValue(null);

      await expect(service.findPackageById('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findPackageById('invalid-id')).rejects.toThrow(
        'Pacote de créditos não encontrado',
      );
    });
  });
  // ────────────────────── resolvePlanPrice (ciclo) ──────────────────────

  describe('resolvePlanPrice', () => {
    const yearlyBrl = {
      planId: 'plan-1',
      currency: 'BRL',
      interval: 'YEARLY',
      priceCents: 28704,
      stripePriceId: 'price_y_brl',
      isActive: true,
    };

    it('busca pelo ciclo MONTHLY por padrão', async () => {
      mockPrisma.planPrice.findUnique.mockResolvedValue({
        ...yearlyBrl,
        interval: 'MONTHLY',
        priceCents: 2990,
        stripePriceId: 'price_m_brl',
      });

      const result = await service.resolvePlanPrice('plan-1', 'brl');

      expect(result.stripePriceId).toBe('price_m_brl');
      expect(mockPrisma.planPrice.findUnique).toHaveBeenCalledWith({
        where: {
          planId_currency_interval: { planId: 'plan-1', currency: 'BRL', interval: 'MONTHLY' },
        },
      });
    });

    it('resolve o preço anual quando pedido YEARLY', async () => {
      mockPrisma.planPrice.findUnique.mockResolvedValue(yearlyBrl);

      const result = await service.resolvePlanPrice('plan-1', 'BRL', 'YEARLY');

      expect(result.priceCents).toBe(28704);
      expect(mockPrisma.planPrice.findUnique).toHaveBeenCalledWith({
        where: {
          planId_currency_interval: { planId: 'plan-1', currency: 'BRL', interval: 'YEARLY' },
        },
      });
    });

    it('cai para USD no mesmo ciclo quando a moeda não tem preço', async () => {
      mockPrisma.planPrice.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...yearlyBrl, currency: 'USD', stripePriceId: 'price_y_usd' });

      const result = await service.resolvePlanPrice('plan-1', 'EUR', 'YEARLY');

      expect(result.stripePriceId).toBe('price_y_usd');
      expect(mockPrisma.planPrice.findUnique).toHaveBeenLastCalledWith({
        where: {
          planId_currency_interval: { planId: 'plan-1', currency: 'USD', interval: 'YEARLY' },
        },
      });
    });

    it('lança NotFound quando o plano não tem anual', async () => {
      mockPrisma.planPrice.findUnique.mockResolvedValue(null);

      await expect(
        service.resolvePlanPrice('plan-1', 'BRL', 'YEARLY'),
      ).rejects.toThrow('Plano anual não disponível');
    });

    it('findAnnualPrice devolve null em vez de lançar', async () => {
      mockPrisma.planPrice.findUnique.mockResolvedValue(null);

      await expect(service.findAnnualPrice('plan-1', 'BRL')).resolves.toBeNull();
    });

    it('ignora preço inativo', async () => {
      mockPrisma.planPrice.findUnique.mockResolvedValue({ ...yearlyBrl, isActive: false });

      await expect(service.findAnnualPrice('plan-1', 'USD')).resolves.toBeNull();
    });
  });
});
