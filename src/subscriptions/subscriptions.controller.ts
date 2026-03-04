import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { SubscriptionResponseDto } from './dto/subscription-response.dto';
import { CurrentUser } from '../common/decorators';

@ApiTags('subscriptions')
@ApiBearerAuth()
@Controller('api/v1/subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  @Get('current')
  @ApiOperation({ summary: 'Assinatura atual do usuário' })
  @ApiResponse({
    status: 200,
    description: 'Assinatura retornada com sucesso',
    type: SubscriptionResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  async getCurrent(
    @CurrentUser('sub') userId: string,
  ): Promise<SubscriptionResponseDto | null> {
    return this.subscriptionsService.getCurrentSubscription(userId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Criar assinatura' })
  @ApiResponse({
    status: 201,
    description: 'Assinatura criada com sucesso',
    type: SubscriptionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Dados inválidos' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 409, description: 'Já possui assinatura ativa' })
  async create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateSubscriptionDto,
  ): Promise<SubscriptionResponseDto> {
    return this.subscriptionsService.createSubscription(
      userId,
      dto.planSlug,
    );
  }

  @Patch('upgrade')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Upgrade de plano' })
  @ApiResponse({
    status: 200,
    description: 'Upgrade realizado com sucesso',
    type: SubscriptionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Plano não é superior ao atual' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 404, description: 'Nenhuma assinatura ativa' })
  async upgrade(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateSubscriptionDto,
  ): Promise<SubscriptionResponseDto> {
    return this.subscriptionsService.upgrade(userId, dto.planSlug);
  }

  @Patch('downgrade')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Downgrade de plano (efetivo próximo ciclo)' })
  @ApiResponse({
    status: 200,
    description: 'Downgrade agendado para o próximo ciclo',
    type: SubscriptionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Plano não é inferior ao atual' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 404, description: 'Nenhuma assinatura ativa' })
  async downgrade(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateSubscriptionDto,
  ): Promise<SubscriptionResponseDto> {
    return this.subscriptionsService.downgrade(userId, dto.planSlug);
  }

  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancelar assinatura (acesso até fim do período)' })
  @ApiResponse({
    status: 200,
    description: 'Assinatura marcada para cancelamento',
    type: SubscriptionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Assinatura já cancelada' })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({ status: 404, description: 'Nenhuma assinatura ativa' })
  async cancel(
    @CurrentUser('sub') userId: string,
  ): Promise<SubscriptionResponseDto> {
    return this.subscriptionsService.cancel(userId);
  }

  @Post('reactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reativar assinatura cancelada' })
  @ApiResponse({
    status: 200,
    description: 'Assinatura reativada com sucesso',
    type: SubscriptionResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Não autenticado' })
  @ApiResponse({
    status: 404,
    description: 'Nenhuma assinatura com cancelamento pendente',
  })
  async reactivate(
    @CurrentUser('sub') userId: string,
  ): Promise<SubscriptionResponseDto> {
    return this.subscriptionsService.reactivate(userId);
  }
}
