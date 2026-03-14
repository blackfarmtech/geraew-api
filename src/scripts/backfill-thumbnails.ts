import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { UploadsModule } from '../uploads/uploads.module';
import { UploadsService } from '../uploads/uploads.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, UploadsModule],
})
class BackfillModule {}

const BATCH_SIZE = 20;
const CONCURRENCY = 5;

async function main() {
  const app = await NestFactory.createApplicationContext(BackfillModule);
  const prisma = app.get(PrismaService);
  const uploads = app.get(UploadsService);

  // Reset previously failed attempts (empty string or same as url)
  const resetResult = await prisma.$executeRaw`
    UPDATE generation_outputs SET thumbnail_url = NULL
    WHERE thumbnail_url = '' OR thumbnail_url = url
  `;
  if (resetResult > 0) {
    console.log(`Reset ${resetResult} previously failed thumbnails`);
  }

  // Only image generation outputs without thumbnails
  const total = await prisma.generationOutput.count({
    where: {
      thumbnailUrl: null,
      generation: {
        type: { in: ['TEXT_TO_IMAGE', 'IMAGE_TO_IMAGE'] },
        status: 'COMPLETED',
      },
    },
  });

  console.log(`Found ${total} outputs without thumbnails`);
  if (total === 0) {
    await app.close();
    return;
  }

  let processed = 0;
  let failed = 0;

  while (true) {
    const batch = await prisma.generationOutput.findMany({
      where: {
        thumbnailUrl: null,
        generation: {
          type: { in: ['TEXT_TO_IMAGE', 'IMAGE_TO_IMAGE'] },
          status: 'COMPLETED',
        },
      },
      select: { id: true, url: true, generationId: true },
      take: BATCH_SIZE,
    });

    if (batch.length === 0) break;

    for (let i = 0; i < batch.length; i += CONCURRENCY) {
      const chunk = batch.slice(i, i + CONCURRENCY);
      await Promise.all(
        chunk.map(async (output) => {
          try {
            const thumbnailUrl = await uploads.generateThumbnailDirect(
              output.url,
              `thumbnails/${output.generationId}`,
              `thumb_${output.id}.jpg`,
            );

            await prisma.generationOutput.update({
              where: { id: output.id },
              data: { thumbnailUrl },
            });

            processed++;
            console.log(`[${processed + failed}/${total}] ✓ ${output.id}`);
          } catch (err) {
            failed++;
            console.error(`[${processed + failed}/${total}] ✗ ${output.id}: ${(err as Error).message}`);
          }
        }),
      );
    }
  }

  console.log(`\nDone! Processed: ${processed}, Failed: ${failed}`);
  await app.close();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
