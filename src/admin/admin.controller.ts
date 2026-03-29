import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { UploadsService } from '../uploads/uploads.service';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PaginationDto } from '../common/dto/pagination.dto';
import { AdjustCreditsDto } from './dto/adjust-credits.dto';
import { AdjustFreeGenerationsDto } from './dto/adjust-free-generations.dto';
import { ToggleUserStatusDto } from './dto/toggle-user-status.dto';
import { ChangeUserPlanDto } from './dto/change-user-plan.dto';
import { AdminStatsResponseDto } from './dto/admin-stats-response.dto';
import { DateRangeDto } from './dto/date-range.dto';
import { AdminUploadDto } from './dto/admin-upload.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('api/v1/admin')
@UseGuards(RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly uploadsService: UploadsService,
  ) {}

  @Get('stats')
  @ApiOperation({ summary: 'Dashboard de estatísticas do admin' })
  @ApiResponse({ status: 200, type: AdminStatsResponseDto })
  async getStats() {
    return this.adminService.getStats();
  }

  @Get('stats/financial')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Estatísticas financeiras (MRR, receita, margem)' })
  async getFinancialStats(@Query() dto: DateRangeDto) {
    return this.adminService.getFinancialStats(dto.days);
  }

  @Get('stats/users')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Estatísticas de usuários (novos, distribuição, churn)' })
  async getUserStats(@Query() dto: DateRangeDto) {
    return this.adminService.getUserStats(dto.days);
  }

  @Get('stats/usage')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Estatísticas de uso (gerações, processamento, erros)' })
  async getUsageStats(@Query() dto: DateRangeDto) {
    return this.adminService.getUsageStats(dto.days);
  }

  @Get('stats/credits')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Estatísticas de créditos (consumo, alocação, reembolsos)' })
  async getCreditStats(@Query() dto: DateRangeDto) {
    return this.adminService.getCreditStats(dto.days);
  }

  @Get('stats/health')
  @ApiOperation({ summary: 'Saúde do sistema (filas, erros, alertas)' })
  async getHealthStats() {
    return this.adminService.getHealthStats();
  }

  @Get('users')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Lista todos os usuários (paginado)' })
  async getUsers(@Query() pagination: PaginationDto) {
    return this.adminService.getUsers(pagination);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Detalhes de um usuário' })
  async getUserById(@Param('id') id: string) {
    return this.adminService.getUserById(id);
  }

  @Patch('users/:id/status')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Ativar ou desativar um usuário' })
  async toggleUserStatus(
    @Param('id') id: string,
    @Body() dto: ToggleUserStatusDto,
  ) {
    await this.adminService.toggleUserStatus(id, dto.isActive);
    const status = dto.isActive ? 'ativado' : 'desativado';
    return { success: true, message: `Usuário ${status} com sucesso` };
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Excluir um usuário permanentemente' })
  async deleteUser(@Param('id') id: string) {
    await this.adminService.deleteUser(id);
    return { success: true, message: 'Usuário excluído com sucesso' };
  }

  @Patch('users/:id/credits')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Ajuste manual de créditos de um usuário' })
  async adjustCredits(
    @Param('id') id: string,
    @Body() dto: AdjustCreditsDto,
  ) {
    await this.adminService.adjustCredits(id, dto.amount, dto.description);
    return { success: true, message: 'Créditos ajustados com sucesso' };
  }

  @Patch('users/:id/free-generations')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Ajustar gerações gratuitas de vídeo de um usuário' })
  async adjustFreeGenerations(
    @Param('id') id: string,
    @Body() dto: AdjustFreeGenerationsDto,
  ) {
    await this.adminService.adjustFreeGenerations(id, dto.amount);
    return { success: true, message: 'Gerações gratuitas ajustadas com sucesso' };
  }

  @Patch('users/:id/plan')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Alterar plano de um usuário' })
  async changeUserPlan(
    @Param('id') id: string,
    @Body() dto: ChangeUserPlanDto,
  ) {
    await this.adminService.changeUserPlan(id, dto.planSlug);
    return { success: true, message: `Plano alterado para "${dto.planSlug}" com sucesso` };
  }

  @Get('users/:id/generations')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Lista gerações de um usuário específico' })
  async getUserGenerations(
    @Param('id') id: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.adminService.getUserGenerations(id, pagination);
  }

  @Get('generations/providers')
  @ApiOperation({ summary: 'Contagem de gerações por provider (geraew vs nano-banana)' })
  async getProviderStats() {
    return this.adminService.getProviderStats();
  }

  @Get('generations')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Lista todas as gerações (monitoramento)' })
  async getGenerations(@Query() pagination: PaginationDto) {
    return this.adminService.getGenerations(pagination);
  }

  @Post('upload')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Gera URL pré-assinada para upload de assets do admin (landing page, galeria, etc.)' })
  async generateAdminUploadUrl(@Body() dto: AdminUploadDto) {
    const sanitizedFilename = dto.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const { uploadUrl, fileKey } = await this.uploadsService.generatePresignedUrl({
      filename: sanitizedFilename,
      contentType: dto.contentType as any,
      purpose: `admin_assets/${dto.folder}` as any,
    });
    const publicUrl = this.uploadsService.getPublicUrl(fileKey);
    return { uploadUrl, fileKey, publicUrl };
  }
}
