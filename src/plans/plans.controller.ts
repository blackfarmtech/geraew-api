import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PlansService } from './plans.service';
import { PlanResponseDto } from './dto/plan-response.dto';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('plans')
@Controller('api/v1/plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Lista todos os planos disponíveis' })
  @ApiResponse({
    status: 200,
    description: 'Lista de planos ativos',
    type: [PlanResponseDto],
  })
  async findAll(): Promise<PlanResponseDto[]> {
    const plans = await this.plansService.findAllPlans();

    return plans.map((plan) => ({
      id: plan.id,
      slug: plan.slug,
      name: plan.name,
      description: plan.description,
      priceCents: plan.priceCents,
      creditsPerMonth: plan.creditsPerMonth,
      maxConcurrentGenerations: plan.maxConcurrentGenerations,
      hasWatermark: plan.hasWatermark,
      galleryRetentionDays: plan.galleryRetentionDays,
      hasApiAccess: plan.hasApiAccess,
    }));
  }
}
