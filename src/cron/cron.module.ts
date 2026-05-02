import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SubscriptionRenewalService } from './subscription-renewal.service';
import { GalleryCleanupService } from './gallery-cleanup.service';
import { StuckGenerationsService } from './stuck-generations.service';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [ScheduleModule.forRoot(), UploadsModule],
  providers: [
    SubscriptionRenewalService,
    GalleryCleanupService,
    StuckGenerationsService,
  ],
})
export class CronModule {}
