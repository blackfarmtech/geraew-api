import { Test, TestingModule } from '@nestjs/testing';
import { PlansController } from '../plans.controller';
import { PlansService } from '../plans.service';

const mockPlansService = {
  findAllPlans: jest.fn(),
  resolvePlanPrice: jest.fn(),
  findAnnualPrice: jest.fn(),
};

describe('PlansController', () => {
  let controller: PlansController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlansController],
      providers: [{ provide: PlansService, useValue: mockPlansService }],
    }).compile();

    controller = module.get<PlansController>(PlansController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    const mockPlans = [
      {
        id: 'plan-1',
        slug: 'free',
        name: 'Free',
        description: 'Free plan',
        priceCents: 0,
        creditsPerMonth: 300,
        maxConcurrentGenerations: 1,
        hasWatermark: true,
        galleryRetentionDays: 30,
        hasApiAccess: false,
        isActive: true,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'plan-2',
        slug: 'pro',
        name: 'Pro',
        description: null,
        priceCents: 8990,
        creditsPerMonth: 35000,
        maxConcurrentGenerations: 5,
        hasWatermark: false,
        galleryRetentionDays: null,
        hasApiAccess: false,
        isActive: true,
        sortOrder: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    beforeEach(() => {
      // Pro: R$ 89,90/mês em BRL; anual R$ 863,04 (20% OFF)
      mockPlansService.resolvePlanPrice.mockResolvedValue({
        currency: 'BRL',
        priceCents: 8990,
        stripePriceId: 'price_m',
      });
      mockPlansService.findAnnualPrice.mockResolvedValue({
        currency: 'BRL',
        priceCents: 86304,
      });
    });

    it('should return mapped plans array', async () => {
      mockPlansService.findAllPlans.mockResolvedValue(mockPlans);

      const result = await controller.findAll({ headers: {} } as any, 'BRL');

      expect(mockPlansService.findAllPlans).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'plan-1',
        slug: 'free',
        name: 'Free',
        description: 'Free plan',
        priceCents: 0,
        currency: 'BRL',
        creditsPerMonth: 300,
        maxConcurrentGenerations: 1,
        hasWatermark: true,
        galleryRetentionDays: 30,
        hasApiAccess: false,
        annual: null,
      });
    });

    it('should return empty array when no plans exist', async () => {
      mockPlansService.findAllPlans.mockResolvedValue([]);

      const result = await controller.findAll({ headers: {} } as any, 'BRL');

      expect(mockPlansService.findAllPlans).toHaveBeenCalledTimes(1);
      expect(result).toEqual([]);
    });

    it('should correctly map all fields and exclude non-DTO fields', async () => {
      mockPlansService.findAllPlans.mockResolvedValue(mockPlans);

      const result = await controller.findAll({ headers: {} } as any, 'BRL');

      const expectedKeys = [
        'id',
        'slug',
        'name',
        'description',
        'priceCents',
        'creditsPerMonth',
        'maxConcurrentGenerations',
        'hasWatermark',
        'galleryRetentionDays',
        'hasApiAccess',
        'currency',
        'annual',
      ];

      for (const plan of result) {
        expect(Object.keys(plan).sort()).toEqual(expectedKeys.sort());
      }

      // Verify second plan with null values maps correctly
      expect(result[1]).toEqual({
        id: 'plan-2',
        slug: 'pro',
        name: 'Pro',
        description: null,
        priceCents: 8990,
        currency: 'BRL',
        creditsPerMonth: 35000,
        maxConcurrentGenerations: 5,
        hasWatermark: false,
        galleryRetentionDays: null,
        hasApiAccess: false,
        annual: {
          priceCents: 86304,
          monthlyEquivalentCents: 7192,
          currency: 'BRL',
          discountPercent: 20,
        },
      });
    });

    it('não consulta preço anual para o Free', async () => {
      mockPlansService.findAllPlans.mockResolvedValue([mockPlans[0]]);

      await controller.findAll({ headers: {} } as any, 'BRL');

      expect(mockPlansService.findAnnualPrice).not.toHaveBeenCalled();
    });

    it('annual = null quando o plano não tem preço anual', async () => {
      mockPlansService.findAllPlans.mockResolvedValue([mockPlans[1]]);
      mockPlansService.findAnnualPrice.mockResolvedValue(null);

      const [pro] = await controller.findAll({ headers: {} } as any, 'BRL');

      expect(pro.annual).toBeNull();
    });

    it('calcula o desconto real contra o mensal da mesma moeda', async () => {
      mockPlansService.findAllPlans.mockResolvedValue([mockPlans[1]]);
      mockPlansService.resolvePlanPrice.mockResolvedValue({
        currency: 'USD',
        priceCents: 1990,
        stripePriceId: 'price_m_usd',
      });
      // 1990 × 12 = 23880; 17910 = 25% OFF
      mockPlansService.findAnnualPrice.mockResolvedValue({
        currency: 'USD',
        priceCents: 17910,
      });

      const [pro] = await controller.findAll({ headers: {} } as any, 'USD');

      expect(pro.currency).toBe('USD');
      expect(pro.annual).toEqual({
        priceCents: 17910,
        monthlyEquivalentCents: 1493,
        currency: 'USD',
        discountPercent: 25,
      });
      expect(mockPlansService.findAnnualPrice).toHaveBeenCalledWith('plan-2', 'USD');
    });
  });
});
