import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AnnouncementsService } from './announcements.service';

@ApiTags('announcements')
@ApiBearerAuth()
@Controller('api/v1/announcements')
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get('active')
  @ApiOperation({ summary: 'Lista avisos ativos para exibir aos usuários' })
  async listActive() {
    return this.announcementsService.listActive();
  }
}
