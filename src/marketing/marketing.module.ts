import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ConversionsService } from './conversions.service';
import { UtmfyDispatcher } from './dispatchers/utmfy.dispatcher';
import { MetaCapiDispatcher } from './dispatchers/meta-capi.dispatcher';

/**
 * Módulo de marketing/atribuição. Global para que ConversionsService possa ser
 * injetado em pagamentos/webhooks sem imports repetidos. ConfigModule já é
 * global (app.module), então os dispatchers leem env direto do ConfigService.
 */
@Global()
@Module({
  imports: [PrismaModule],
  providers: [ConversionsService, UtmfyDispatcher, MetaCapiDispatcher],
  exports: [ConversionsService],
})
export class MarketingModule {}
