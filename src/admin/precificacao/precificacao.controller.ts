import { Body, Controller, Get, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PrecificacaoService } from './precificacao.service';
import { PricingConfig } from './precificacao.defaults';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('api/v1/admin/precificacao')
@UseGuards(RolesGuard)
@Roles('ADMIN')
export class PrecificacaoController {
  constructor(private readonly service: PrecificacaoService) {}

  /** Relatório completo de precificação (config + custos + métricas ao vivo). Usa cache. */
  @Get()
  getReport(@Query('refresh') refresh?: string) {
    return this.service.getReport(refresh === 'true' || refresh === '1');
  }

  /** Recalcula tudo (invalida cache da Stripe e do banco). */
  @Post('refresh')
  refresh() {
    return this.service.getReport(true);
  }

  @Get('config')
  getConfig() {
    return this.service.getConfig();
  }

  /** Atualiza a configuração editável (câmbio, custos de IA, infra, etc.). */
  @Patch('config')
  saveConfig(@Body() body: Partial<PricingConfig>) {
    return this.service.saveConfig(body);
  }
}
