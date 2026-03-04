import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GalleryCleanupService {
  private readonly logger = new Logger(GalleryCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 3 * * *')
  async handleGalleryCleanup() {
    try {
      const now = new Date();

      const result = await this.prisma.generation.updateMany({
        where: {
          expiresAt: { lte: now },
          isDeleted: false,
        },
        data: {
          isDeleted: true,
        },
      });

      if (result.count > 0) {
        this.logger.log(
          `Marked ${result.count} expired generations as deleted`,
        );
      }

      // TODO: Add S3/R2 file cleanup for deleted generations
    } catch (error) {
      this.logger.error(
        `Gallery cleanup cron failed: ${error.message}`,
        error.stack,
      );
    }
  }
}
