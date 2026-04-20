import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminStripeController } from './stripe/admin-stripe.controller';
import { AdminStripeService } from './stripe/admin-stripe.service';
import { PrismaModule } from '../prisma/prisma.module';
import { UploadsModule } from '../uploads/uploads.module';
import { ModelsModule } from '../models/models.module';

@Module({
  imports: [PrismaModule, UploadsModule, ModelsModule],
  controllers: [AdminController, AdminStripeController],
  providers: [AdminService, AdminStripeService],
})
export class AdminModule {}
