import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CreditsService } from './credits.service';
import { CurrentUser } from '../common/decorators';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CreditBalanceResponseDto } from './dto/credit-balance-response.dto';
import { CreditTransactionResponseDto } from './dto/credit-transaction-response.dto';
import { EstimateCostDto, EstimateCostResponseDto } from './dto/estimate-cost.dto';
import { PurchaseCreditsDto } from './dto/purchase-credits.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { PlansService } from '../plans/plans.service';

@ApiTags('credits')
@ApiBearerAuth()
@Controller('api/v1/credits')
export class CreditsController {
  constructor(
    private readonly creditsService: CreditsService,
    private readonly plansService: PlansService,
  ) {}

  @Get('balance')
  @ApiOperation({ summary: 'Saldo detalhado de créditos (plan + bonus)' })
  @ApiResponse({
    status: 200,
    description: 'Saldo retornado com sucesso',
    type: CreditBalanceResponseDto,
  })
  async getBalance(
    @CurrentUser('sub') userId: string,
  ): Promise<CreditBalanceResponseDto> {
    return this.creditsService.getBalance(userId);
  }

  @Get('transactions')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Histórico de transações de créditos (paginado)' })
  @ApiResponse({
    status: 200,
    description: 'Transações retornadas com sucesso',
  })
  async getTransactions(
    @CurrentUser('sub') userId: string,
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<CreditTransactionResponseDto>> {
    return this.creditsService.getTransactions(userId, pagination);
  }

  @Get('packages')
  @ApiOperation({ summary: 'Lista pacotes de créditos disponíveis' })
  @ApiResponse({
    status: 200,
    description: 'Pacotes retornados com sucesso',
  })
  async getPackages() {
    return this.creditsService.getPackages();
  }

  @Post('purchase')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Compra pacote de créditos avulso (placeholder)' })
  @ApiResponse({
    status: 200,
    description: 'Informações do pacote para checkout',
  })
  async purchaseCredits(
    @CurrentUser('sub') userId: string,
    @Body() dto: PurchaseCreditsDto,
  ) {
    const pkg = await this.plansService.findPackageById(dto.packageId);

    return {
      message: 'Checkout de pacote de créditos (placeholder — integração de pagamento pendente)',
      package: {
        id: pkg.id,
        name: pkg.name,
        credits: pkg.credits,
        priceCents: pkg.priceCents,
      },
      userId,
    };
  }

  @Post('estimate')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Calcula custo de uma geração antes de executar' })
  @ApiResponse({
    status: 200,
    description: 'Estimativa calculada com sucesso',
    type: EstimateCostResponseDto,
  })
  async estimateCost(
    @CurrentUser('sub') userId: string,
    @Body() dto: EstimateCostDto,
  ): Promise<EstimateCostResponseDto> {
    return this.creditsService.estimateCost(
      userId,
      dto.type,
      dto.resolution,
      dto.durationSeconds,
      dto.hasAudio,
    );
  }
}
