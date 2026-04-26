import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PendingGrantsService } from './pending-grants.service';
import { HublaWebhookController } from './hubla-webhook.controller';
import { HublaWebhookService } from './hubla-webhook.service';
import { HotmartWebhookController } from './hotmart-webhook.controller';
import { HotmartWebhookService } from './hotmart-webhook.service';
import { GreennWebhookController } from './greenn-webhook.controller';
import { GreennWebhookService } from './greenn-webhook.service';
import { WebhookLogsModule } from '../webhook-logs/webhook-logs.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [PrismaModule, WebhookLogsModule, EmailModule],
  controllers: [
    HublaWebhookController,
    HotmartWebhookController,
    GreennWebhookController,
  ],
  providers: [
    PendingGrantsService,
    HublaWebhookService,
    HotmartWebhookService,
    GreennWebhookService,
  ],
  exports: [PendingGrantsService],
})
export class PendingGrantsModule {}
