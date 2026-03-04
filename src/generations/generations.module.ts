import { Module } from '@nestjs/common';
import { GenerationsController } from './generations.controller';
import { GenerationsService } from './generations.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CreditsModule } from '../credits/credits.module';
import { PlansModule } from '../plans/plans.module';
import { UploadsModule } from '../uploads/uploads.module';
import { NanoBananaProvider } from './providers/nano-banana.provider';
import { KlingProvider } from './providers/kling.provider';
import { VeoProvider } from './providers/veo.provider';

@Module({
  imports: [PrismaModule, CreditsModule, PlansModule, UploadsModule],
  controllers: [GenerationsController],
  providers: [
    GenerationsService,
    NanoBananaProvider,
    KlingProvider,
    VeoProvider,
  ],
  exports: [GenerationsService],
})
export class GenerationsModule {}
