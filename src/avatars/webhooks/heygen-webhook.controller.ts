import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  RawBodyRequest,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '../../common/decorators';
import { HeyGenProvider } from '../providers/heygen.provider';
import { HeyGenWebhookEvent, HeyGenWebhookService } from './heygen-webhook.service';

@ApiTags('webhooks')
@Controller('api/v1/webhooks')
export class HeyGenWebhookController {
  private readonly logger = new Logger(HeyGenWebhookController.name);

  constructor(
    private readonly heygen: HeyGenProvider,
    private readonly webhookService: HeyGenWebhookService,
  ) {}

  @Public()
  @Post('heygen')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'HeyGen webhook endpoint (avatar + video events)' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  @ApiResponse({ status: 401, description: 'Invalid signature' })
  @ApiResponse({ status: 400, description: 'Invalid payload' })
  async heygenWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-heygen-signature') signature: string,
  ): Promise<{ received: true }> {
    const rawBuffer = req.rawBody ?? Buffer.from(JSON.stringify(req.body));
    const rawString = rawBuffer.toString('utf8');

    // Verify HMAC. Refuse silently-cheap; never run handler before this.
    if (!this.heygen.verifyWebhookSignature(rawString, signature)) {
      this.logger.warn(
        `[heygen-webhook] invalid signature signature=${signature?.slice(0, 16)}... rawLen=${rawString.length}`,
      );
      throw new UnauthorizedException('Invalid signature');
    }

    let parsed: HeyGenWebhookEvent;
    try {
      parsed = JSON.parse(rawString) as HeyGenWebhookEvent;
    } catch {
      throw new BadRequestException('Invalid JSON payload');
    }
    if (!parsed.event_type || !parsed.event_data) {
      throw new BadRequestException('Missing event_type or event_data');
    }

    await this.webhookService.handle(parsed, parsed);
    return { received: true };
  }
}
