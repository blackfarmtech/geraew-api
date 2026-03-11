import { Module } from '@nestjs/common';
import { GenerationsController } from './generations.controller';
import { GenerationsService } from './generations.service';
import { GenerationEventsService } from './generation-events.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CreditsModule } from '../credits/credits.module';
import { PlansModule } from '../plans/plans.module';
import { UploadsModule } from '../uploads/uploads.module';
import { GeraewProvider } from './providers/geraew.provider';

@Module({
  imports: [PrismaModule, CreditsModule, PlansModule, UploadsModule],
  controllers: [GenerationsController],
  providers: [GenerationsService, GenerationEventsService, GeraewProvider],
  exports: [GenerationsService],
})
export class GenerationsModule {}
