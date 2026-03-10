import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GenerationStatus, GenerationType } from '@prisma/client';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { GenerationResponseDto } from '../generations/dto/generation-response.dto';
import { GalleryStatsResponseDto } from './dto/gallery-stats-response.dto';

@Injectable()
export class GalleryService {
  constructor(private readonly prisma: PrismaService) {}

  async getGallery(
    userId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<GenerationResponseDto>> {
    const where = {
      userId,
      status: GenerationStatus.COMPLETED,
      isDeleted: false,
    };

    const [generations, total] = await Promise.all([
      this.prisma.generation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
        include: {
          outputs: { orderBy: { order: 'asc' } },
          inputImages: { orderBy: { order: 'asc' } },
        },
      }),
      this.prisma.generation.count({ where }),
    ]);

    const data: GenerationResponseDto[] = generations.map((gen) => ({
      id: gen.id,
      type: gen.type,
      status: gen.status,
      prompt: gen.prompt ?? undefined,
      negativePrompt: gen.negativePrompt ?? undefined,
      resolution: gen.resolution,
      durationSeconds: gen.durationSeconds ?? undefined,
      hasAudio: gen.hasAudio,
      modelUsed: gen.modelUsed ?? undefined,
      parameters: (gen.parameters as Record<string, unknown>) ?? undefined,
      outputs: gen.outputs.map((o) => ({
        id: o.id,
        url: o.url,
        mimeType: o.mimeType ?? undefined,
        order: o.order,
      })),
      inputImages: gen.inputImages.map((img) => ({
        id: img.id,
        role: img.role,
        mimeType: img.mimeType ?? undefined,
        order: img.order,
        referenceType: img.referenceType ?? undefined,
        url: img.url ?? undefined,
      })),
      hasWatermark: gen.hasWatermark,
      creditsConsumed: gen.creditsConsumed,
      processingTimeMs: gen.processingTimeMs ?? undefined,
      errorMessage: gen.errorMessage ?? undefined,
      errorCode: gen.errorCode ?? undefined,
      isFavorited: gen.isFavorited,
      createdAt: gen.createdAt,
      completedAt: gen.completedAt ?? undefined,
    }));

    return new PaginatedResponseDto(data, total, pagination.page, pagination.limit);
  }

  async getStats(userId: string): Promise<GalleryStatsResponseDto> {
    const baseWhere = {
      userId,
      status: GenerationStatus.COMPLETED,
      isDeleted: false,
    };

    const [totalGenerations, creditsAgg, favoriteCount, typeCounts] =
      await Promise.all([
        this.prisma.generation.count({ where: baseWhere }),
        this.prisma.generation.aggregate({
          where: baseWhere,
          _sum: { creditsConsumed: true },
        }),
        this.prisma.generation.count({
          where: { ...baseWhere, isFavorited: true },
        }),
        this.prisma.generation.groupBy({
          by: ['type'],
          where: baseWhere,
          _count: true,
        }),
      ]);

    const generationsByType = {
      TEXT_TO_IMAGE: 0,
      IMAGE_TO_IMAGE: 0,
      TEXT_TO_VIDEO: 0,
      IMAGE_TO_VIDEO: 0,
      MOTION_CONTROL: 0,
    };

    for (const entry of typeCounts) {
      generationsByType[entry.type] = entry._count;
    }

    return {
      totalGenerations,
      totalCreditsUsed: creditsAgg._sum.creditsConsumed ?? 0,
      generationsByType,
      favoriteCount,
    };
  }
}
