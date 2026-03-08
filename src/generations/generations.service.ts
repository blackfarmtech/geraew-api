import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreditsService } from '../credits/credits.service';
import { PlansService } from '../plans/plans.service';
import {
  GenerationType,
  GenerationStatus,
  CreditTransactionType,
  Resolution,
} from '@prisma/client';
import { GenerationFiltersDto } from './dto/generation-filters.dto';
import { GenerationResponseDto, CreateGenerationResponseDto } from './dto/generation-response.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { NanoBananaProvider } from './providers/nano-banana.provider';
import { KlingProvider } from './providers/kling.provider';
import { VeoProvider } from './providers/veo.provider';
import { GeminiMediaProvider } from './providers/gemini-media.provider';
import { VertexGeminiProvider } from './providers/vertex-gemini.provider';
import { BaseProvider, GenerationInput } from './providers/base.provider';
import { UploadsService } from '../uploads/uploads.service';

@Injectable()
export class GenerationsService {
  private readonly logger = new Logger(GenerationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly creditsService: CreditsService,
    private readonly plansService: PlansService,
    private readonly uploadsService: UploadsService,
    private readonly nanoBananaProvider: NanoBananaProvider,
    private readonly klingProvider: KlingProvider,
    private readonly veoProvider: VeoProvider,
    private readonly geminiMediaProvider: GeminiMediaProvider,
    private readonly vertexGeminiProvider: VertexGeminiProvider,
  ) { }

  async createGeneration(
    userId: string,
    type: GenerationType,
    dto: {
      prompt?: string;
      negativePrompt?: string;
      inputImageUrl?: string;
      referenceVideoUrl?: string;
      resolution: Resolution;
      durationSeconds?: number;
      hasAudio?: boolean;
      aspectRatio?: string;
      outputFormat?: string;
      googleSearch?: boolean;
      imageModel?: string;
      referenceImageUrls?: string[];
      lastFrameUrl?: string;
      parameters?: Record<string, unknown>;
    },
  ): Promise<CreateGenerationResponseDto> {
    const hasAudio = dto.hasAudio ?? false;

    // 1. Calculate credits required
    const creditsRequired = await this.plansService.calculateGenerationCost(
      type,
      dto.resolution,
      dto.durationSeconds,
      hasAudio,
    );

    // 2. Check sufficient balance
    const balance = await this.creditsService.getBalance(userId);
    if (balance.totalCreditsAvailable < creditsRequired) {
      throw new BadRequestException({
        code: 'INSUFFICIENT_CREDITS',
        message: `Créditos insuficientes. Necessário: ${creditsRequired}, disponível: ${balance.totalCreditsAvailable}.`,
        statusCode: 402,
      });
    }

    // 3. Check concurrent generation limit
    // await this.checkConcurrentLimit(userId);

    // 4. Debit credits
    // We create the generation first (inside a transaction) so we can reference its ID
    const generation = await this.prisma.$transaction(async (tx) => {
      // Create generation record
      const gen = await tx.generation.create({
        data: {
          userId,
          type,
          status: GenerationStatus.PROCESSING,
          prompt: dto.prompt,
          negativePrompt: dto.negativePrompt,
          inputImageUrl: dto.inputImageUrl,
          referenceVideoUrl: dto.referenceVideoUrl,
          resolution: dto.resolution,
          durationSeconds: dto.durationSeconds,
          hasAudio,
          parameters: {
            ...(dto.parameters ?? {}),
            ...(dto.aspectRatio ? { aspectRatio: dto.aspectRatio } : {}),
            ...(dto.outputFormat ? { outputFormat: dto.outputFormat } : {}),
            ...(dto.googleSearch !== undefined ? { googleSearch: dto.googleSearch } : {}),
            ...(dto.imageModel ? { imageModel: dto.imageModel } : {}),
            ...(dto.referenceImageUrls?.length ? { referenceImageUrls: dto.referenceImageUrls } : {}),
          } as any,
          creditsConsumed: creditsRequired,
        },
      });

      return gen;
    });

    // Debit credits (uses its own transaction)
    await this.creditsService.debit(
      userId,
      creditsRequired,
      CreditTransactionType.GENERATION_DEBIT,
      generation.id,
      `Geração ${type} ${dto.resolution}`,
    );

    // 5. Fire-and-forget background processing
    this.processGeneration(generation).catch((error) => {
      this.handleFailure(generation.id, userId, creditsRequired, error);
    });

    // 6. Return immediately
    return {
      id: generation.id,
      status: GenerationStatus.PROCESSING,
      creditsConsumed: creditsRequired,
    };
  }

  private async checkConcurrentLimit(userId: string): Promise<void> {
    // Get user's active subscription to know the plan limits
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: ['ACTIVE', 'TRIALING'] },
      },
      include: { plan: true },
    });

    const maxConcurrent = subscription?.plan?.maxConcurrentGenerations ?? 1;

    const activeCount = await this.prisma.generation.count({
      where: {
        userId,
        status: GenerationStatus.PROCESSING,
      },
    });

    if (activeCount >= maxConcurrent) {
      throw new BadRequestException({
        code: 'MAX_CONCURRENT_REACHED',
        message: `Limite de ${maxConcurrent} geração(ões) simultânea(s) atingido. Aguarde a conclusão das gerações em andamento.`,
        statusCode: 429,
      });
    }
  }

  private getProvider(type: GenerationType): BaseProvider {
    switch (type) {
      case GenerationType.TEXT_TO_IMAGE:
      case GenerationType.IMAGE_TO_IMAGE:
        return this.vertexGeminiProvider;
      case GenerationType.MOTION_CONTROL:
        return this.klingProvider;
      case GenerationType.TEXT_TO_VIDEO:
      case GenerationType.IMAGE_TO_VIDEO:
        return this.geminiMediaProvider;
      default:
        throw new BadRequestException(`Tipo de geração não suportado: ${type}`);
    }
  }

  private async processGeneration(generation: {
    id: string;
    type: GenerationType;
    prompt: string | null;
    negativePrompt: string | null;
    inputImageUrl: string | null;
    referenceVideoUrl: string | null;
    resolution: Resolution;
    durationSeconds: number | null;
    hasAudio: boolean;
    parameters: unknown;
  }): Promise<void> {
    const startTime = Date.now();

    // Update processing_started_at
    await this.prisma.generation.update({
      where: { id: generation.id },
      data: { processingStartedAt: new Date() },
    });

    const provider = this.getProvider(generation.type);

    // Resolve S3 file keys to signed URLs so external APIs can access them
    const inputImageUrl = generation.inputImageUrl
      ? await this.resolveFileUrl(generation.inputImageUrl)
      : undefined;
    const referenceVideoUrl = generation.referenceVideoUrl
      ? await this.resolveFileUrl(generation.referenceVideoUrl)
      : undefined;

    const input: GenerationInput = {
      id: generation.id,
      type: generation.type,
      prompt: generation.prompt ?? undefined,
      negativePrompt: generation.negativePrompt ?? undefined,
      inputImageUrl,
      referenceVideoUrl,
      resolution: generation.resolution,
      durationSeconds: generation.durationSeconds ?? undefined,
      hasAudio: generation.hasAudio,
      parameters: (generation.parameters as Record<string, unknown>) ?? undefined,
    };

    const result = await provider.generate(input);

    const processingTimeMs = Date.now() - startTime;

    await this.prisma.generation.update({
      where: { id: generation.id },
      data: {
        status: GenerationStatus.COMPLETED,
        outputUrl: result.outputUrl,
        thumbnailUrl: result.thumbnailUrl,
        modelUsed: result.modelUsed,
        processingTimeMs,
        completedAt: new Date(),
      },
    });

    this.logger.log(`Generation ${generation.id} completed in ${processingTimeMs}ms`);
  }

  private async handleFailure(
    generationId: string,
    userId: string,
    creditsConsumed: number,
    error: Error,
  ): Promise<void> {
    this.logger.error(`Generation ${generationId} failed: ${error.message}`, error.stack);

    await this.prisma.generation.update({
      where: { id: generationId },
      data: {
        status: GenerationStatus.FAILED,
        errorMessage: error.message,
        errorCode: 'GENERATION_FAILED',
      },
    });

    // Refund credits
    await this.creditsService.refund(userId, creditsConsumed, generationId);

    this.logger.log(`Refunded ${creditsConsumed} credits for failed generation ${generationId}`);
  }

  async findById(userId: string, generationId: string): Promise<GenerationResponseDto> {
    const generation = await this.prisma.generation.findFirst({
      where: {
        id: generationId,
        userId,
        isDeleted: false,
      },
    });

    if (!generation) {
      throw new NotFoundException('Geração não encontrada');
    }

    return this.toResponseDto(generation);
  }

  async findAll(
    userId: string,
    filters: GenerationFiltersDto,
  ): Promise<PaginatedResponseDto<GenerationResponseDto>> {
    const where: Record<string, unknown> = {
      userId,
      isDeleted: false,
    };

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.favorited !== undefined) {
      where.isFavorited = filters.favorited;
    }

    // Parse sort
    let orderBy: Record<string, string> = { createdAt: 'desc' };
    if (filters.sort) {
      const [field, direction] = filters.sort.split(':');
      const fieldMap: Record<string, string> = {
        created_at: 'createdAt',
        completed_at: 'completedAt',
        credits_consumed: 'creditsConsumed',
      };
      const mappedField = fieldMap[field] || field;
      orderBy = { [mappedField]: direction };
    }

    const [generations, total] = await Promise.all([
      this.prisma.generation.findMany({
        where,
        orderBy,
        skip: filters.skip,
        take: filters.limit,
      }),
      this.prisma.generation.count({ where }),
    ]);

    const data = generations.map((gen) => this.toResponseDto(gen));

    return new PaginatedResponseDto(data, total, filters.page, filters.limit);
  }

  async softDelete(userId: string, generationId: string): Promise<void> {
    const generation = await this.prisma.generation.findFirst({
      where: { id: generationId, userId },
    });

    if (!generation) {
      throw new NotFoundException('Geração não encontrada');
    }

    await this.prisma.generation.update({
      where: { id: generationId },
      data: { isDeleted: true },
    });
  }

  async toggleFavorite(
    userId: string,
    generationId: string,
    isFavorited: boolean,
  ): Promise<void> {
    const generation = await this.prisma.generation.findFirst({
      where: { id: generationId, userId, isDeleted: false },
    });

    if (!generation) {
      throw new NotFoundException('Geração não encontrada');
    }

    await this.prisma.generation.update({
      where: { id: generationId },
      data: { isFavorited },
    });
  }

  private toResponseDto(generation: {
    id: string;
    type: GenerationType;
    status: GenerationStatus;
    prompt: string | null;
    negativePrompt: string | null;
    inputImageUrl: string | null;
    referenceVideoUrl: string | null;
    resolution: Resolution;
    durationSeconds: number | null;
    hasAudio: boolean;
    modelUsed: string | null;
    parameters: unknown;
    outputUrl: string | null;
    thumbnailUrl: string | null;
    hasWatermark: boolean;
    creditsConsumed: number;
    processingTimeMs: number | null;
    errorMessage: string | null;
    errorCode: string | null;
    isFavorited: boolean;
    createdAt: Date;
    completedAt: Date | null;
  }): GenerationResponseDto {
    return {
      id: generation.id,
      type: generation.type,
      status: generation.status,
      prompt: generation.prompt ?? undefined,
      negativePrompt: generation.negativePrompt ?? undefined,
      inputImageUrl: generation.inputImageUrl ?? undefined,
      referenceVideoUrl: generation.referenceVideoUrl ?? undefined,
      resolution: generation.resolution,
      durationSeconds: generation.durationSeconds ?? undefined,
      hasAudio: generation.hasAudio,
      modelUsed: generation.modelUsed ?? undefined,
      parameters: (generation.parameters as Record<string, unknown>) ?? undefined,
      outputUrl: generation.outputUrl ?? undefined,
      thumbnailUrl: generation.thumbnailUrl ?? undefined,
      hasWatermark: generation.hasWatermark,
      creditsConsumed: generation.creditsConsumed,
      processingTimeMs: generation.processingTimeMs ?? undefined,
      errorMessage: generation.errorMessage ?? undefined,
      errorCode: generation.errorCode ?? undefined,
      isFavorited: generation.isFavorited,
      createdAt: generation.createdAt,
      completedAt: generation.completedAt ?? undefined,
    };
  }

  /**
   * If the value looks like an S3 file key (no protocol), generate a signed URL.
   * If it's already a full URL, return as-is.
   */
  private async resolveFileUrl(value: string): Promise<string> {
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return value;
    }
    return this.uploadsService.getSignedReadUrl(value);
  }
}
