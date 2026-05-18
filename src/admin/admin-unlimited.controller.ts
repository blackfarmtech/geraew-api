import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  AdminUnlimitedService,
  UnlimitedJobStatusFilter,
} from './admin-unlimited.service';

const ALLOWED_STATUS: UnlimitedJobStatusFilter[] = [
  'waiting',
  'active',
  'delayed',
  'completed',
  'failed',
  'paused',
];

@ApiTags('admin')
@ApiBearerAuth()
@Controller('api/v1/admin/unlimited')
@UseGuards(RolesGuard)
@Roles('ADMIN')
export class AdminUnlimitedController {
  constructor(private readonly service: AdminUnlimitedService) {}

  @Get('queue/stats')
  @ApiOperation({
    summary: 'Stats da fila ilimitada (waiting, active, delayed, completed, failed)',
  })
  async queueStats() {
    return this.service.getQueueStats();
  }

  @Get('queue/jobs')
  @ApiOperation({
    summary:
      'Lista jobs da fila ilimitada filtrados por status, com user/generation enriquecidos',
  })
  async queueJobs(
    @Query('status') status: string = 'waiting',
    @Query('limit') limit?: string,
  ) {
    if (!ALLOWED_STATUS.includes(status as UnlimitedJobStatusFilter)) {
      throw new BadRequestException(
        `status inválido. Use um destes: ${ALLOWED_STATUS.join(', ')}`,
      );
    }
    return this.service.listJobs({
      status: status as UnlimitedJobStatusFilter,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  @Get('usage/overview')
  @ApiOperation({
    summary:
      'Uso do modo ilimitado nas últimas 24h (total, breakdown por modelo, top usuários)',
  })
  async usageOverview() {
    return this.service.getUsageOverview();
  }
}
