import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AffiliatesService } from './affiliates.service';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';

@ApiTags('affiliates')
@ApiBearerAuth()
@Controller('api/v1/affiliates')
export class AffiliateMeController {
  constructor(private readonly affiliatesService: AffiliatesService) {}

  @Get('me')
  @ApiOperation({ summary: 'Painel do afiliado logado' })
  async getMyAffiliate(@CurrentUser() user: JwtPayload) {
    return this.affiliatesService.getMyAffiliate(user.sub);
  }
}
