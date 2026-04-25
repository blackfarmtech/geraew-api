import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser, Public } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { PlansService } from '../plans/plans.service';
import { AbacatepayService } from './abacatepay.service';
import { AbacatepayWebhookService } from './webhooks/abacatepay-webhook.service';
import { CreateBoostPixDto } from './dto/create-boost-pix.dto';
import { PixResponseDto } from './dto/pix-response.dto';

@ApiTags('abacatepay')
@Controller('api/v1')
export class AbacatepayController {
  constructor(
    private readonly abacatepayService: AbacatepayService,
    private readonly abacatepayWebhookService: AbacatepayWebhookService,
    private readonly plansService: PlansService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('payments/pix/boost')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Cria um PIX QR Code para compra de pacote de créditos' })
  @ApiResponse({ status: 201, type: PixResponseDto })
  async createBoostPix(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateBoostPixDto,
  ): Promise<PixResponseDto> {
    const pkg = await this.plansService.findPackageById(dto.packageId);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true, name: true, referredByCode: true },
    });

    const price = await this.plansService.resolvePackagePrice(pkg.id, 'BRL');

    // AbacatePay v1 exige customer.cellphone quando o objeto customer é enviado.
    // Como não temos celular do usuário, omitimos customer; metadata basta para
    // reconciliar no webhook (userId/packageId).
    const pix = await this.abacatepayService.createPixCharge({
      amountCents: price.priceCents,
      description: `Boost — ${pkg.name}`.slice(0, 37),
      expiresInSeconds: 3600,
      metadata: {
        userId,
        packageId: pkg.id,
        packageName: pkg.name,
        credits: pkg.credits,
        userEmail: user.email,
        userName: user.name,
        ...(dto.taxId ? { taxId: dto.taxId } : {}),
        ...(user.referredByCode ? { referredByCode: user.referredByCode } : {}),
      },
    });

    return {
      abacatepayId: pix.id,
      amountCents: pix.amount,
      status: pix.status,
      brCode: pix.brCode,
      brCodeBase64: pix.brCodeBase64,
      expiresAt: pix.expiresAt,
      devMode: pix.devMode,
    };
  }

  @Get('payments/pix/:id/status')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Consulta status de um PIX (para polling no frontend)' })
  @ApiResponse({ status: 200, description: 'Status do PIX' })
  async getPixStatus(@Param('id') id: string): Promise<{ status: string; paid: boolean }> {
    const pix = await this.abacatepayService.checkPixStatus(id);
    return { status: pix.status, paid: pix.status === 'PAID' };
  }

  @Public()
  @Post('webhooks/abacatepay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook da AbacatePay (configurar com ?webhookSecret=...)' })
  @ApiResponse({ status: 200, description: 'Webhook processado' })
  @ApiResponse({ status: 401, description: 'webhookSecret inválido' })
  async webhook(
    @Query('webhookSecret') webhookSecret: string | undefined,
    @Body() payload: Record<string, unknown>,
  ): Promise<{ received: true }> {
    await this.abacatepayWebhookService.handleWebhook(webhookSecret, payload);
    return { received: true };
  }
}
