import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { GenerationsController } from './generations.controller';
import { GenerationsService } from './generations.service';
import { GenerationEventsService } from './generation-events.service';
import { GenerationProcessor } from './queue/generation.processor';
import { GENERATION_QUEUE } from './queue/generation-queue.constants';
import { PrismaModule } from '../prisma/prisma.module';
import { CreditsModule } from '../credits/credits.module';
import { PlansModule } from '../plans/plans.module';
import { UploadsModule } from '../uploads/uploads.module';
import { GeraewProvider } from './providers/geraew.provider';
import { NanoBananaProvider } from './providers/nano-banana.provider';
import { WanProvider } from './providers/wan.provider';

@Module({
  imports: [
    PrismaModule,
    CreditsModule,
    PlansModule,
    UploadsModule,
    BullModule.registerQueue({
      name: GENERATION_QUEUE,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'fixed', delay: 30_000 },
        removeOnComplete: { age: 24 * 3600 },
        removeOnFail: { age: 7 * 24 * 3600 },
      },
    }),
  ],
  controllers: [GenerationsController],
  providers: [
    GenerationsService,
    GenerationEventsService,
    GenerationProcessor,
    GeraewProvider,
    NanoBananaProvider,
    WanProvider,
  ],
  exports: [GenerationsService],
})
export class GenerationsModule {}
