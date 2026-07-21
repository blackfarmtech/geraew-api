import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminCronsService } from './admin-crons.service';
import { PixAutoBillingService } from '../cron/pix-auto-billing.service';
import { RunPixBillingDto } from './dto/run-pix-billing.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('api/v1/admin/crons')
@UseGuards(RolesGuard)
@Roles('ADMIN')
export class AdminCronsController {
  constructor(
    private readonly service: AdminCronsService,
    private readonly pixBilling: PixAutoBillingService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lista todos os crons com último status + próxima execução' })
  async listCrons() {
    return this.service.listCrons();
  }

  @Get('executions')
  @ApiOperation({ summary: 'Histórico paginado de execuções (filtra por cronName / status)' })
  async getExecutions(
    @Query('cronName') cronName?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getExecutions({
      cronName,
      status,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Post('pix-billing/run')
  @ApiOperation({
    summary:
      'Dispara manualmente o cron de cobrança PIX Auto. Default: no máximo 1 cobrança real.',
  })
  async runPixBilling(@Body() body: RunPixBillingDto) {
    return this.pixBilling.run(new Date(), {
      maxCharges: body.maxCharges ?? 1,
      onlySubscriptionId: body.subscriptionId,
      dryRunOverride: body.dryRun,
    });
  }
}
