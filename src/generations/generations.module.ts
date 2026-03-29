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
import { FaceSwapProvider } from './providers/face-swap.provider';
import { PromptEnhancerModule } from '../prompt-enhancer/prompt-enhancer.module';

@Module({
  imports: [
    PrismaModule,
    CreditsModule,
    PlansModule,
    UploadsModule,
    PromptEnhancerModule,
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
    FaceSwapProvider,
  ],
  exports: [GenerationsService],
})
export class GenerationsModule {}
