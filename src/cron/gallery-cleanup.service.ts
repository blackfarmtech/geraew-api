import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';

@Injectable()
export class GalleryCleanupService {
  private readonly logger = new Logger(GalleryCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadsService: UploadsService,
  ) {}

  @Cron('0 3 * * *')
  async handleGalleryCleanup() {
    try {
      const now = new Date();

      // Find expired generations with their outputs for S3 cleanup
      const expiredGenerations = await this.prisma.generation.findMany({
        where: {
          expiresAt: { lte: now },
          isDeleted: false,
        },
        select: {
          id: true,
          outputs: { select: { url: true, thumbnailUrl: true } },
        },
        take: 200, // Process in batches to avoid memory issues
      });

      if (expiredGenerations.length === 0) return;

      // Mark as deleted in DB
      await this.prisma.generation.updateMany({
        where: {
          id: { in: expiredGenerations.map((g) => g.id) },
        },
        data: { isDeleted: true },
      });

      this.logger.log(
        `Marked ${expiredGenerations.length} expired generations as deleted`,
      );

      // Delete S3 files in background (outputs + thumbnails)
      for (const gen of expiredGenerations) {
        this.deleteGenerationFiles(gen.id).catch((err) => {
          this.logger.warn(
            `Failed to delete S3 files for generation ${gen.id}: ${(err as Error).message}`,
          );
        });
      }
    } catch (error) {
      this.logger.error(
        `Gallery cleanup cron failed: ${error.message}`,
        error.stack,
      );
    }
  }

  private async deleteGenerationFiles(generationId: string): Promise<void> {
    const [outputsDeleted, thumbnailsDeleted] = await Promise.all([
      this.uploadsService.deleteByPrefix(`outputs/${generationId}/`),
      this.uploadsService.deleteByPrefix(`thumbnails/${generationId}/`),
    ]);

    if (outputsDeleted + thumbnailsDeleted > 0) {
      this.logger.log(
        `Deleted ${outputsDeleted + thumbnailsDeleted} S3 file(s) for expired generation ${generationId}`,
      );
    }
  }
}
