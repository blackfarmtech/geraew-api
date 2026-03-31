import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AffiliatesService } from './affiliates.service';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateAffiliateDto } from './dto/create-affiliate.dto';
import { MarkEarningsPaidDto } from './dto/mark-paid.dto';

@ApiTags('affiliates')
@ApiBearerAuth()
@Controller('api/v1/admin/affiliates')
@UseGuards(RolesGuard)
@Roles('ADMIN')
export class AffiliatesController {
  constructor(private readonly affiliatesService: AffiliatesService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Dashboard de afiliados (totais gerais)' })
  async getDashboard() {
    return this.affiliatesService.getDashboard();
  }

  @Post()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Criar novo afiliado' })
  async create(@Body() dto: CreateAffiliateDto) {
    return this.affiliatesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos os afiliados' })
  async findAll() {
    return this.affiliatesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhes de um afiliado' })
  async findById(@Param('id') id: string) {
    return this.affiliatesService.findById(id);
  }

  @Get(':id/earnings')
  @ApiOperation({ summary: 'Comissões de um afiliado' })
  async getEarnings(@Param('id') id: string) {
    return this.affiliatesService.getEarnings(id);
  }

  @Patch(':id/toggle-active')
  @ApiOperation({ summary: 'Ativar/desativar afiliado' })
  async toggleActive(@Param('id') id: string) {
    return this.affiliatesService.toggleActive(id);
  }

  @Post('earnings/mark-paid')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Marcar comissões como pagas' })
  async markPaid(@Body() dto: MarkEarningsPaidDto) {
    return this.affiliatesService.markEarningsPaid(dto.earningIds);
  }
}
