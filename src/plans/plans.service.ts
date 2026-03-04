import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GenerationType, Resolution } from '@prisma/client';

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

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
    hasAudio: boolean = false,
  ) {
    const cost = await this.prisma.creditCost.findUnique({
      where: {
        generationType_resolution_hasAudio: {
          generationType,
          resolution,
          hasAudio,
        },
      },
    });

    if (!cost) {
      throw new NotFoundException(
        `Custo de crédito não encontrado para ${generationType} ${resolution} (audio: ${hasAudio})`,
      );
    }

    return cost;
  }

  async calculateGenerationCost(
    generationType: GenerationType,
    resolution: Resolution,
    durationSeconds?: number,
    hasAudio: boolean = false,
  ): Promise<number> {
    const cost = await this.getCreditCost(generationType, resolution, hasAudio);

    if (cost.isPerSecond && durationSeconds) {
      return cost.creditsPerUnit * durationSeconds;
    }

    return cost.creditsPerUnit;
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
