import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { AiModel, AiModelProvider, AiModelType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const CACHE_TTL_MS = 60_000; // 60s

@Injectable()
export class ModelsService implements OnModuleInit {
  private readonly logger = new Logger(ModelsService.name);
  private videoCache: { data: AiModel[]; expiresAt: number } | null = null;
  private imageCache: { data: AiModel[]; expiresAt: number } | null = null;
  private audioCache: { data: AiModel[]; expiresAt: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Garante que a entrada gateway de áudio exista no banco. Como o seed nem
   * sempre roda em produção, fazemos upsert no startup. Falhas são apenas
   * logadas (ex: enum AUDIO ainda não adicionado no Postgres) — quando o admin
   * adicionar o valor do enum manualmente, o próximo restart cria a linha.
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.prisma.aiModel.upsert({
        where: { slug: 'audio-generation' },
        update: {},
        create: {
          slug: 'audio-generation',
          label: 'Geração de áudio',
          description:
            'Gateway para geração de áudio (TTS Inworld 1.5 Max + clonagem OmniVoice). Desativar este modelo bloqueia todas as gerações de áudio temporariamente.',
          provider: AiModelProvider.WAVESPEED,
          modelVariant: 'wavespeed/inworld+omnivoice',
          sortOrder: 100,
          type: AiModelType.AUDIO,
          isActive: true,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to ensure 'audio-generation' AiModel row: ${
          err instanceof Error ? err.message : err
        }. If the error mentions the AUDIO enum, run "ALTER TYPE \\"AiModelType\\" ADD VALUE IF NOT EXISTS 'AUDIO';" in your database.`,
      );
    }
  }

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

  async listAudioModels(): Promise<AiModel[]> {
    const now = Date.now();
    if (this.audioCache && this.audioCache.expiresAt > now) {
      return this.audioCache.data;
    }

    const models = await this.prisma.aiModel.findMany({
      where: { type: AiModelType.AUDIO },
      orderBy: { sortOrder: 'asc' },
    });

    this.audioCache = { data: models, expiresAt: now + CACHE_TTL_MS };
    return models;
  }

  async assertActiveBySlug(slug: string, type: AiModelType): Promise<AiModel> {
    const models =
      type === AiModelType.VIDEO
        ? await this.listVideoModels()
        : type === AiModelType.IMAGE
          ? await this.listImageModels()
          : type === AiModelType.AUDIO
            ? await this.listAudioModels()
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
    this.audioCache = null;
  }
}
