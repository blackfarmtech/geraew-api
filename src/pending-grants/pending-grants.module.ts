import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PendingGrantsService } from './pending-grants.service';
import { HublaWebhookController } from './hubla-webhook.controller';
import { HublaWebhookService } from './hubla-webhook.service';
import { HotmartWebhookController } from './hotmart-webhook.controller';
import { HotmartWebhookService } from './hotmart-webhook.service';
import { WebhookLogsModule } from '../webhook-logs/webhook-logs.module';

@Module({
  imports: [PrismaModule, WebhookLogsModule],
  controllers: [HublaWebhookController, HotmartWebhookController],
  providers: [
    PendingGrantsService,
    HublaWebhookService,
    HotmartWebhookService,
  ],
  exports: [PendingGrantsService],
})
export class PendingGrantsModule {}
