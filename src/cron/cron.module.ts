import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SubscriptionRenewalService } from './subscription-renewal.service';
import { PaymentRetryService } from './payment-retry.service';
import { GalleryCleanupService } from './gallery-cleanup.service';
import { StuckGenerationsService } from './stuck-generations.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [
    SubscriptionRenewalService,
    PaymentRetryService,
    GalleryCleanupService,
    StuckGenerationsService,
  ],
})
export class CronModule {}
