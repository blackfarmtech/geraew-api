import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { AiModel, AiModelProvider, AiModelType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const CACHE_TTL_MS = 60_000; // 60s

@Injectable()
export class ModelsService {
  private readonly logger = new Logger(ModelsService.name);
  private videoCache: { data: AiModel[]; expiresAt: number } | null = null;
  private imageCache: { data: AiModel[]; expiresAt: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async deactivateGeraewVideoModels(statusMessage: string): Promise<number> {
    const result = await this.prisma.aiModel.updateMany({
      where: {
        provider: AiModelProvider.GERAEW,
        type: AiModelType.VIDEO,
        isActive: true,
      },
      data: { isActive: false, statusMessage },
    });

    if (result.count > 0) {
      this.logger.warn(
        `Auto-disabled ${result.count} GeraEW video model(s): ${statusMessage}`,
      );
      this.invalidateCache();
    }

    return result.count;
  }

  async listVideoModels(): Promise<AiModel[]> {
    const now = Date.now();
    if (this.videoCache && this.videoCache.expiresAt > now) {
      return this.videoCache.data;
    }

    const models = await this.prisma.aiModel.findMany({
      where: { type: AiModelType.VIDEO },
      orderBy: { sortOrder: 'asc' },
    });

    this.videoCache = { data: models, expiresAt: now + CACHE_TTL_MS };
    return models;
  }

  async listImageModels(): Promise<AiModel[]> {
    const now = Date.now();
    if (this.imageCache && this.imageCache.expiresAt > now) {
      return this.imageCache.data;
    }

    const models = await this.prisma.aiModel.findMany({
      where: { type: AiModelType.IMAGE },
      orderBy: { sortOrder: 'asc' },
    });

    this.imageCache = { data: models, expiresAt: now + CACHE_TTL_MS };
    return models;
  }

  async assertActiveBySlug(slug: string, type: AiModelType): Promise<AiModel> {
    const models =
      type === AiModelType.VIDEO
        ? await this.listVideoModels()
        : type === AiModelType.IMAGE
          ? await this.listImageModels()
          : [];
    const model = models.find((m) => m.slug === slug);

    if (!model) {
      throw new HttpException(
        {
          code: 'MODEL_NOT_FOUND',
          message: `O modelo "${slug}" não existe. Escolha outro e tente novamente.`,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!model.isActive) {
      throw new HttpException(
        {
          code: 'MODEL_DISABLED',
          message:
            model.statusMessage ??
            `O modelo "${model.label}" está temporariamente indisponível. Escolha outro e tente novamente.`,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    return model;
  }

  invalidateCache(): void {
    this.videoCache = null;
    this.imageCache = null;
  }
}
