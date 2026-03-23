import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GenerationType, Resolution } from '@prisma/client';

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) { }

  async findAllPlans() {
    return this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findPlanBySlug(slug: string) {
    const plan = await this.prisma.plan.findUnique({
      where: { slug },
    });

    if (!plan) {
      throw new NotFoundException(`Plano "${slug}" não encontrado`);
    }

    return plan;
  }

  async findPlanById(id: string) {
    const plan = await this.prisma.plan.findUnique({
      where: { id },
    });

    if (!plan) {
      throw new NotFoundException('Plano não encontrado');
    }

    return plan;
  }

  async getCreditCost(
    generationType: GenerationType,
    resolution: Resolution,
    hasAudio: boolean,
    modelVariant?: string | null,
  ) {
    const cost = await this.prisma.creditCost.findFirst({
      where: {
        generationType,
        resolution,
        hasAudio,
        modelVariant: modelVariant ?? null,
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
    return this.prisma.creditPackage.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findPackageById(id: string) {
    const pkg = await this.prisma.creditPackage.findUnique({
      where: { id },
    });

    if (!pkg) {
      throw new NotFoundException('Pacote de créditos não encontrado');
    }

    return pkg;
  }
}
