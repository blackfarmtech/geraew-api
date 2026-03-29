import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { GenerationType, Resolution } from '@prisma/client';

/**
 * Maps plan slugs to env var names for Stripe price IDs.
 * Allows dev/test to use different price IDs without touching the database.
 */
const PLAN_PRICE_ENV: Record<string, string> = {
  starter: 'STRIPE_PRICE_PLAN_STARTER',
  creator: 'STRIPE_PRICE_PLAN_CREATOR',
  pro: 'STRIPE_PRICE_PLAN_PRO',
  studio: 'STRIPE_PRICE_PLAN_STUDIO',
};

const PACKAGE_PRICE_ENV: Record<string, string> = {
  'boost p': 'STRIPE_PRICE_BOOST_P',
  'boost m': 'STRIPE_PRICE_BOOST_M',
  'boost g': 'STRIPE_PRICE_BOOST_G',
};

@Injectable()
export class PlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Override stripePriceId with env var value when available.
   * This allows test mode to use different Stripe prices without touching the DB.
   */
  private overridePriceId<T extends { slug?: string; name?: string; stripePriceId: string | null }>(
    record: T,
    envMap: Record<string, string>,
    key: 'slug' | 'name' = 'slug',
  ): T {
    const lookup = (record[key] ?? '').toLowerCase();
    const envVar = envMap[lookup];
    if (envVar) {
      const envValue = this.configService.get<string>(envVar);
      if (envValue) {
        return { ...record, stripePriceId: envValue };
      }
    }
    return record;
  }

  async findAllPlans() {
    const plans = await this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    return plans.map((p) => this.overridePriceId(p, PLAN_PRICE_ENV));
  }

  async findPlanBySlug(slug: string) {
    const plan = await this.prisma.plan.findUnique({
      where: { slug },
    });

    if (!plan) {
      throw new NotFoundException(`Plano "${slug}" não encontrado`);
    }

    return this.overridePriceId(plan, PLAN_PRICE_ENV);
  }

  async findPlanById(id: string) {
    const plan = await this.prisma.plan.findUnique({
      where: { id },
    });

    if (!plan) {
      throw new NotFoundException('Plano não encontrado');
    }

    return this.overridePriceId(plan, PLAN_PRICE_ENV);
  }

  async getCreditCost(
    generationType: GenerationType,
    resolution: Resolution,
    hasAudio: boolean,
    modelVariant?: string | null,
  ) {
    // Default to NB2 for image-based types when no variant is specified,
    // since all image credit_costs rows require a model variant.
    const IMAGE_TYPES: GenerationType[] = [
      GenerationType.TEXT_TO_IMAGE,
      GenerationType.IMAGE_TO_IMAGE,
      GenerationType.VIRTUAL_TRY_ON,
      GenerationType.FACE_SWAP,
    ];
    const resolvedVariant =
      !modelVariant && IMAGE_TYPES.includes(generationType)
        ? 'NB2'
        : (modelVariant ?? null);

    const cost = await this.prisma.creditCost.findFirst({
      where: {
        generationType,
        resolution,
        hasAudio,
        modelVariant: resolvedVariant,
        isActive: true,
      },
    });

    if (!cost) {
      throw new NotFoundException(
        `Custo de crédito não encontrado para ${generationType} ${resolution} (audio: ${hasAudio}, variant: ${modelVariant ?? 'default'})`,
      );
    }

    return cost;
  }

  async calculateGenerationCost(
    generationType: GenerationType,
    resolution: Resolution,
    durationSeconds?: number,
    hasAudio: boolean = false,
    sampleCount: number = 1,
    modelVariant?: string | null,
  ): Promise<number> {
    const cost = await this.getCreditCost(generationType, resolution, hasAudio, modelVariant);

    let total = cost.creditsPerUnit;
    if (cost.isPerSecond && durationSeconds) {
      total = cost.creditsPerUnit * durationSeconds;
    }

    // 1-4 vídeos custam o mesmo (preço de 1)
    const effectiveSamples = sampleCount <= 4 ? 1 : sampleCount;
    return total * Math.max(effectiveSamples, 1);
  }

  async findAllPackages() {
    const packages = await this.prisma.creditPackage.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    return packages.map((p) => this.overridePriceId(p, PACKAGE_PRICE_ENV, 'name'));
  }

  async findPackageById(id: string) {
    const pkg = await this.prisma.creditPackage.findUnique({
      where: { id },
    });

    if (!pkg) {
      throw new NotFoundException('Pacote de créditos não encontrado');
    }

    return this.overridePriceId(pkg, PACKAGE_PRICE_ENV, 'name');
  }
}
