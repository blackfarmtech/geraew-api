import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { PlansModule } from './plans/plans.module';
import { UsersModule } from './users/users.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { CustomThrottlerGuard } from './common/guards/throttle.guard';
import { UploadsModule } from './uploads/uploads.module';
import { WebhookLogsModule } from './webhook-logs/webhook-logs.module';
import { CreditsModule } from './credits/credits.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { AdminModule } from './admin/admin.module';
import { CronModule } from './cron/cron.module';
import { PaymentsModule } from './payments/payments.module';
import { GenerationsModule } from './generations/generations.module';
import { GalleryModule } from './gallery/gallery.module';
import { FoldersModule } from './folders/folders.module';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'default',
          ttl: 60000,
          limit: 30,
        },
      ],
    }),
    PrismaModule,
    AuthModule,
    PlansModule,
    UsersModule,
    UploadsModule,
    WebhookLogsModule,
    CreditsModule,
    SubscriptionsModule,
    AdminModule,
    CronModule,
    PaymentsModule,
    GenerationsModule,
    GalleryModule,
    FoldersModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
  ],
})
export class AppModule {}
