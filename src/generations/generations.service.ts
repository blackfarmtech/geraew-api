import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreditsService } from '../credits/credits.service';
import { PlansService } from '../plans/plans.service';
import {
  GenerationType,
  GenerationStatus,
  CreditTransactionType,
  Resolution,
  GenerationImageRole,
} from '@prisma/client';
import { GenerationFiltersDto } from './dto/generation-filters.dto';
import {
  GenerationResponseDto,
  CreateGenerationResponseDto,
} from './dto/generation-response.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { UploadsService } from '../uploads/uploads.service';
import { GeraewProvider } from './providers/geraew.provider';
import { NanoBananaProvider, mapGeminiToNanoBanana } from './providers/nano-banana.provider';
import { GenerationEventsService } from './generation-events.service';
import { GenerateVideoTextToVideoDto } from './dto/videos/generate-video-text-to-video.dto';
import { GenerateVideoImageToVideoDto } from './dto/videos/generate-video-image-to-video.dto';
import { GenerateVideoWithReferencesDto } from './dto/videos/generate-video-with-references.dto';
import { GenerateImageDto } from './dto/generate-image.dto';
import { GenerateImageNanoBananaDto } from './dto/generate-image-nano-banana.dto';

type GenerationWithRelations = {
  id: string;
  type: GenerationType;
  status: GenerationStatus;
  prompt: string | null;
  negativePrompt: string | null;
  resolution: Resolution;
  durationSeconds: number | null;
  hasAudio: boolean;
  modelUsed: string;
  parameters: unknown;
  hasWatermark: boolean;
  creditsConsumed: number;
  processingTimeMs: number | null;
  errorMessage: string | null;
  errorCode: string | null;
  isFavorited: boolean;
  createdAt: Date;
  completedAt: Date | null;
  outputs: Array<{ id: string; url: string; thumbnailUrl: string | null; mimeType: string | null; order: number }>;
  inputImages: Array<{
    id: string;
    role: GenerationImageRole;
    mimeType: string | null;
    order: number;
    referenceType: string | null;
    url: string | null;
  }>;
};

@Injectable()
export class GenerationsService {
  private readonly logger = new Logger(GenerationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly creditsService: CreditsService,
    private readonly plansService: PlansService,
    private readonly uploadsService: UploadsService,
    private readonly geraewProvider: GeraewProvider,
    private readonly nanoBananaProvider: NanoBananaProvider,
    private readonly generationEvents: GenerationEventsService,
  ) {}

  // ─── Image generation (text-to-image / image-to-image) ────

  async generateImage(
    userId: string,
    dto: GenerateImageDto,
  ): Promise<CreateGenerationResponseDto> {
    const type =
      dto.images?.length
        ? GenerationType.IMAGE_TO_IMAGE
        : GenerationType.TEXT_TO_IMAGE;

    const creditsRequired = await this.plansService.calculateGenerationCost(
      type,
      dto.resolution,
    );

    await this.ensureSufficientBalance(userId, creditsRequired);

    const generation = await this.prisma.generation.create({
      data: {
        userId,
        type,
        status: GenerationStatus.PROCESSING,
        prompt: dto.prompt,
        modelUsed: dto.model,
        resolution: dto.resolution,
        aspectRatio: dto.aspect_ratio,
        hasAudio: false,
        creditsConsumed: creditsRequired,
        parameters: { mimeType: dto.mime_type },
      },
    });

    if (dto.images?.length) {
      const uploadedUrls = await Promise.all(
        dto.images.map((img) =>
          this.uploadBase64Image(img.base64, img.mime_type ?? 'image/png', generation.id),
        ),
      );
      await this.prisma.generationInputImage.createMany({
        data: dto.images.map((img, i) => ({
          generationId: generation.id,
          role: GenerationImageRole.REFERENCE,
          mimeType: img.mime_type ?? 'image/png',
          order: i,
          url: uploadedUrls[i],
        })),
      });
    }

    await this.debitCredits(userId, creditsRequired, generation.id, type, dto.resolution);

    this.processImageGeneration(generation.id, dto).catch((error) => {
      this.handleFailure(generation.id, userId, creditsRequired, error);
    });

    return {
      id: generation.id,
      status: GenerationStatus.PROCESSING,
      creditsConsumed: creditsRequired,
    };
  }

  // ─── Image generation with fallback (geraew → nano-banana) ─

  async generateImageWithFallback(
    userId: string,
    dto: GenerateImageDto,
  ): Promise<CreateGenerationResponseDto> {
    const type =
      dto.images?.length
        ? GenerationType.IMAGE_TO_IMAGE
        : GenerationType.TEXT_TO_IMAGE;

    const creditsRequired = await this.plansService.calculateGenerationCost(
      type,
      dto.resolution,
    );

    await this.ensureSufficientBalance(userId, creditsRequired);

    const generation = await this.prisma.generation.create({
      data: {
        userId,
        type,
        status: GenerationStatus.PROCESSING,
        prompt: dto.prompt,
        modelUsed: dto.model,
        resolution: dto.resolution,
        aspectRatio: dto.aspect_ratio,
        hasAudio: false,
        creditsConsumed: creditsRequired,
        parameters: { mimeType: dto.mime_type, provider: 'geraew' },
      },
    });

    if (dto.images?.length) {
      const uploadedUrls = await Promise.all(
        dto.images.map((img) =>
          this.uploadBase64Image(img.base64, img.mime_type ?? 'image/png', generation.id),
        ),
      );
      await this.prisma.generationInputImage.createMany({
        data: dto.images.map((img, i) => ({
          generationId: generation.id,
          role: GenerationImageRole.REFERENCE,
          mimeType: img.mime_type ?? 'image/png',
          order: i,
          url: uploadedUrls[i],
        })),
      });
    }

    await this.debitCredits(userId, creditsRequired, generation.id, type, dto.resolution);

    this.processImageWithFallback(generation.id, userId, creditsRequired, dto).catch(
      (error) => {
        this.handleFailure(generation.id, userId, creditsRequired, error);
      },
    );

    return {
      id: generation.id,
      status: GenerationStatus.PROCESSING,
      creditsConsumed: creditsRequired,
    };
  }

  // ─── Image generation via Nano Banana 2 (kie-api) ────────

  async generateImageNanoBanana(
    userId: string,
    dto: GenerateImageNanoBananaDto,
  ): Promise<CreateGenerationResponseDto> {
    const type =
      dto.images?.length
        ? GenerationType.IMAGE_TO_IMAGE
        : GenerationType.TEXT_TO_IMAGE;

    const creditsRequired = await this.plansService.calculateGenerationCost(
      type,
      dto.resolution,
    );

    await this.ensureSufficientBalance(userId, creditsRequired);

    const generation = await this.prisma.generation.create({
      data: {
        userId,
        type,
        status: GenerationStatus.PROCESSING,
        prompt: dto.prompt,
        modelUsed: dto.model ?? 'nano-banana-2',
        resolution: dto.resolution,
        aspectRatio: dto.aspect_ratio,
        hasAudio: false,
        creditsConsumed: creditsRequired,
        parameters: {
          output_format: dto.output_format,
          google_search: dto.google_search,
        },
      },
    });

    let imageUrls: string[] | undefined;
    if (dto.images?.length) {
      const uploadedUrls = await Promise.all(
        dto.images.map((img) =>
          this.uploadBase64Image(
            img.base64,
            img.mime_type ?? 'image/png',
            generation.id,
          ),
        ),
      );
      await this.prisma.generationInputImage.createMany({
        data: dto.images.map((img, i) => ({
          generationId: generation.id,
          role: GenerationImageRole.REFERENCE,
          mimeType: img.mime_type ?? 'image/png',
          order: i,
          url: uploadedUrls[i],
        })),
      });
      imageUrls = uploadedUrls;
    }

    await this.debitCredits(
      userId,
      creditsRequired,
      generation.id,
      type,
      dto.resolution,
    );

    this.processNanoBananaImageGeneration(generation.id, dto, imageUrls).catch(
      (error) => {
        this.handleFailure(generation.id, userId, creditsRequired, error);
      },
    );

    return {
      id: generation.id,
      status: GenerationStatus.PROCESSING,
      creditsConsumed: creditsRequired,
    };
  }

  // ─── Text to Video ────────────────────────────────────────

  async generateTextToVideo(
    userId: string,
    dto: GenerateVideoTextToVideoDto,
  ): Promise<CreateGenerationResponseDto> {
    const type = GenerationType.TEXT_TO_VIDEO;
    const hasAudio = dto.generate_audio ?? true;

    const sampleCount = dto.sample_count ?? 1;

    const creditsRequired = await this.plansService.calculateGenerationCost(
      type,
      dto.resolution,
      dto.duration_seconds,
      hasAudio,
      sampleCount,
    );

    await this.ensureSufficientBalance(userId, creditsRequired);

    const generation = await this.prisma.generation.create({
      data: {
        userId,
        type,
        status: GenerationStatus.PROCESSING,
        prompt: dto.prompt,
        negativePrompt: dto.negative_prompt,
        modelUsed: dto.model,
        resolution: dto.resolution,
        durationSeconds: dto.duration_seconds,
        hasAudio,
        aspectRatio: dto.aspect_ratio,
        quantity: sampleCount,
        creditsConsumed: creditsRequired,
      },
    });

    await this.debitCredits(userId, creditsRequired, generation.id, type, dto.resolution);

    this.processTextToVideoGeneration(generation.id, dto).catch((error) => {
      this.handleFailure(generation.id, userId, creditsRequired, error);
    });

    return {
      id: generation.id,
      status: GenerationStatus.PROCESSING,
      creditsConsumed: creditsRequired,
    };
  }

  // ─── Image to Video ───────────────────────────────────────

  async generateImageToVideo(
    userId: string,
    dto: GenerateVideoImageToVideoDto,
  ): Promise<CreateGenerationResponseDto> {
    const type = GenerationType.IMAGE_TO_VIDEO;
    const model = dto.model ?? 'veo-3.1-generate-preview';
    const hasAudio = dto.generate_audio ?? true;

    const sampleCount = dto.sample_count ?? 1;

    const creditsRequired = await this.plansService.calculateGenerationCost(
      type,
      dto.resolution,
      dto.duration_seconds,
      hasAudio,
      sampleCount,
    );

    await this.ensureSufficientBalance(userId, creditsRequired);

    const generation = await this.prisma.generation.create({
      data: {
        userId,
        type,
        status: GenerationStatus.PROCESSING,
        prompt: dto.prompt,
        negativePrompt: dto.negative_prompt,
        modelUsed: model,
        resolution: dto.resolution,
        durationSeconds: dto.duration_seconds,
        hasAudio,
        aspectRatio: dto.aspect_ratio,
        quantity: sampleCount,
        creditsConsumed: creditsRequired,
      },
    });

    const firstFrameUrl = await this.uploadBase64Image(
      dto.first_frame,
      dto.first_frame_mime_type ?? 'image/jpeg',
      generation.id,
    );
    const inputImageData: Array<{
      generationId: string;
      role: GenerationImageRole;
      mimeType: string;
      order: number;
      url: string;
    }> = [
      {
        generationId: generation.id,
        role: GenerationImageRole.FIRST_FRAME,
        mimeType: dto.first_frame_mime_type ?? 'image/jpeg',
        order: 0,
        url: firstFrameUrl,
      },
    ];
    if (dto.last_frame) {
      const lastFrameUrl = await this.uploadBase64Image(
        dto.last_frame,
        dto.last_frame_mime_type ?? 'image/jpeg',
        generation.id,
      );
      inputImageData.push({
        generationId: generation.id,
        role: GenerationImageRole.LAST_FRAME,
        mimeType: dto.last_frame_mime_type ?? 'image/jpeg',
        order: 1,
        url: lastFrameUrl,
      });
    }
    await this.prisma.generationInputImage.createMany({ data: inputImageData });

    await this.debitCredits(userId, creditsRequired, generation.id, type, dto.resolution);

    this.processImageToVideoGeneration(generation.id, dto, model).catch(
      (error) => {
        this.handleFailure(generation.id, userId, creditsRequired, error);
      },
    );

    return {
      id: generation.id,
      status: GenerationStatus.PROCESSING,
      creditsConsumed: creditsRequired,
    };
  }

  // ─── Video with References ────────────────────────────────

  async generateVideoWithReferences(
    userId: string,
    dto: GenerateVideoWithReferencesDto,
  ): Promise<CreateGenerationResponseDto> {
    const type = GenerationType.REFERENCE_VIDEO;
    const model = dto.model ?? 'veo-3.1-generate-preview';
    const hasAudio = dto.generate_audio ?? true;

    const sampleCount = dto.sample_count ?? 1;

    const creditsRequired = await this.plansService.calculateGenerationCost(
      type,
      dto.resolution,
      dto.duration_seconds,
      hasAudio,
      sampleCount,
    );

    await this.ensureSufficientBalance(userId, creditsRequired);

    const generation = await this.prisma.generation.create({
      data: {
        userId,
        type,
        status: GenerationStatus.PROCESSING,
        prompt: dto.prompt,
        negativePrompt: dto.negative_prompt,
        modelUsed: model,
        resolution: dto.resolution,
        durationSeconds: dto.duration_seconds,
        hasAudio,
        aspectRatio: dto.aspect_ratio,
        quantity: sampleCount,
        creditsConsumed: creditsRequired,
      },
    });

    if (dto.reference_images?.length) {
      const uploadedUrls = await Promise.all(
        dto.reference_images.map((ref) =>
          this.uploadBase64Image(ref.base64, ref.mime_type ?? 'image/jpeg', generation.id),
        ),
      );
      await this.prisma.generationInputImage.createMany({
        data: dto.reference_images.map((ref, i) => ({
          generationId: generation.id,
          role: GenerationImageRole.REFERENCE,
          mimeType: ref.mime_type ?? 'image/jpeg',
          order: i,
          referenceType: ref.reference_type,
          url: uploadedUrls[i],
        })),
      });
    }

    await this.debitCredits(userId, creditsRequired, generation.id, type, dto.resolution);

    this.processReferenceVideoGeneration(generation.id, dto, model).catch(
      (error) => {
        this.handleFailure(generation.id, userId, creditsRequired, error);
      },
    );

    return {
      id: generation.id,
      status: GenerationStatus.PROCESSING,
      creditsConsumed: creditsRequired,
    };
  }

  // ─── Background processors ────────────────────────────────

  private async processImageGeneration(
    generationId: string,
    dto: GenerateImageDto,
  ): Promise<void> {
    const startTime = Date.now();

    await this.prisma.generation.update({
      where: { id: generationId },
      data: { processingStartedAt: new Date() },
    });

    const result = await this.geraewProvider.generateImage({
      id: generationId,
      prompt: dto.prompt,
      model: dto.model,
      resolution: dto.resolution,
      aspectRatio: dto.aspect_ratio,
      mimeType: dto.mime_type,
      images: dto.images?.map((img) => ({
        base64: img.base64,
        mimeType: img.mime_type ?? 'image/png',
      })),
    });

    await this.completeGeneration(generationId, result, startTime);
  }

  private async processImageWithFallback(
    generationId: string,
    userId: string,
    creditsConsumed: number,
    dto: GenerateImageDto,
  ): Promise<void> {
    const startTime = Date.now();

    await this.prisma.generation.update({
      where: { id: generationId },
      data: { processingStartedAt: new Date() },
    });

    try {
      const result = await this.geraewProvider.generateImage({
        id: generationId,
        prompt: dto.prompt,
        model: dto.model,
        resolution: dto.resolution,
        aspectRatio: dto.aspect_ratio,
        mimeType: dto.mime_type,
        images: dto.images?.map((img) => ({
          base64: img.base64,
          mimeType: img.mime_type ?? 'image/png',
        })),
      });

      await this.completeGeneration(generationId, result, startTime, 'geraew');
    } catch (geraewError) {
      this.logger.warn(
        `Geraew failed for ${generationId}, falling back to Nano Banana: ${(geraewError as Error).message}`,
      );

      try {
        const inputImages = await this.prisma.generationInputImage.findMany({
          where: { generationId },
        });
        const imageUrls = inputImages
          .map((img) => img.url)
          .filter(Boolean) as string[];

        const nanaBananaModel = mapGeminiToNanoBanana(dto.model);
        const result = await this.nanoBananaProvider.generateImage({
          id: generationId,
          model: nanaBananaModel,
          prompt: dto.prompt,
          resolution: dto.resolution,
          aspectRatio: dto.aspect_ratio,
          outputFormat: dto.mime_type === 'image/jpeg' ? 'jpg' : 'png',
          imageUrls: imageUrls.length ? imageUrls : undefined,
        });

        await this.completeGeneration(generationId, result, startTime, nanaBananaModel);
      } catch (fallbackError) {
        throw fallbackError;
      }
    }
  }

  private async processNanoBananaImageGeneration(
    generationId: string,
    dto: GenerateImageNanoBananaDto,
    imageUrls?: string[],
  ): Promise<void> {
    const startTime = Date.now();

    await this.prisma.generation.update({
      where: { id: generationId },
      data: { processingStartedAt: new Date() },
    });

    const result = await this.nanoBananaProvider.generateImage({
      id: generationId,
      model: dto.model,
      prompt: dto.prompt,
      resolution: dto.resolution,
      aspectRatio: dto.aspect_ratio,
      outputFormat: dto.output_format,
      googleSearch: dto.google_search,
      imageUrls,
    });

    await this.completeGeneration(generationId, result, startTime);
  }

  private async processTextToVideoGeneration(
    generationId: string,
    dto: GenerateVideoTextToVideoDto,
  ): Promise<void> {
    const startTime = Date.now();

    await this.prisma.generation.update({
      where: { id: generationId },
      data: { processingStartedAt: new Date() },
    });

    const result = await this.geraewProvider.generateTextToVideo({
      id: generationId,
      prompt: dto.prompt,
      model: dto.model,
      resolution: dto.resolution,
      durationSeconds: dto.duration_seconds,
      aspectRatio: dto.aspect_ratio,
      generateAudio: dto.generate_audio ?? true,
      sampleCount: dto.sample_count,
      negativePrompt: dto.negative_prompt,
    });

    await this.completeGeneration(generationId, result, startTime);
  }

  private async processImageToVideoGeneration(
    generationId: string,
    dto: GenerateVideoImageToVideoDto,
    model: string,
  ): Promise<void> {
    const startTime = Date.now();

    await this.prisma.generation.update({
      where: { id: generationId },
      data: { processingStartedAt: new Date() },
    });

    const result = await this.geraewProvider.generateImageToVideo({
      id: generationId,
      prompt: dto.prompt,
      model,
      resolution: dto.resolution,
      durationSeconds: dto.duration_seconds,
      aspectRatio: dto.aspect_ratio,
      generateAudio: dto.generate_audio ?? true,
      sampleCount: dto.sample_count,
      negativePrompt: dto.negative_prompt,
      firstFrame: dto.first_frame,
      firstFrameMimeType: dto.first_frame_mime_type ?? 'image/jpeg',
      lastFrame: dto.last_frame,
      lastFrameMimeType: dto.last_frame_mime_type,
    });

    await this.completeGeneration(generationId, result, startTime);
  }

  private async processReferenceVideoGeneration(
    generationId: string,
    dto: GenerateVideoWithReferencesDto,
    model: string,
  ): Promise<void> {
    const startTime = Date.now();

    await this.prisma.generation.update({
      where: { id: generationId },
      data: { processingStartedAt: new Date() },
    });

    const result = await this.geraewProvider.generateVideoWithReferences({
      id: generationId,
      prompt: dto.prompt,
      model,
      resolution: dto.resolution,
      durationSeconds: dto.duration_seconds,
      aspectRatio: dto.aspect_ratio,
      generateAudio: dto.generate_audio ?? true,
      sampleCount: dto.sample_count,
      negativePrompt: dto.negative_prompt,
      referenceImages: (dto.reference_images ?? []).map((ref) => ({
        base64: ref.base64,
        mimeType: ref.mime_type ?? 'image/jpeg',
        referenceType: ref.reference_type,
      })),
    });

    await this.completeGeneration(generationId, result, startTime);
  }

  // ─── Shared helpers ───────────────────────────────────────

  private async ensureSufficientBalance(
    userId: string,
    creditsRequired: number,
  ): Promise<void> {
    const balance = await this.creditsService.getBalance(userId);
    if (balance.totalCreditsAvailable < creditsRequired) {
      throw new BadRequestException({
        code: 'INSUFFICIENT_CREDITS',
        message: `Créditos insuficientes. Necessário: ${creditsRequired}, disponível: ${balance.totalCreditsAvailable}.`,
        statusCode: 402,
      });
    }
  }

  private async debitCredits(
    userId: string,
    creditsRequired: number,
    generationId: string,
    type: GenerationType,
    resolution: Resolution,
  ): Promise<void> {
    await this.creditsService.debit(
      userId,
      creditsRequired,
      CreditTransactionType.GENERATION_DEBIT,
      generationId,
      `Geração ${type} ${resolution}`,
    );
  }

  private async completeGeneration(
    generationId: string,
    result: { outputUrls: string[]; modelUsed: string },
    startTime: number,
    provider?: string,
  ): Promise<void> {
    const processingTimeMs = Date.now() - startTime;

    const updateData: Record<string, unknown> = {
      status: GenerationStatus.COMPLETED,
      modelUsed: result.modelUsed,
      processingTimeMs,
      completedAt: new Date(),
    };

    if (provider) {
      const existing = await this.prisma.generation.findUnique({
        where: { id: generationId },
        select: { parameters: true },
      });
      const params =
        existing?.parameters && typeof existing.parameters === 'object'
          ? (existing.parameters as Record<string, unknown>)
          : {};
      updateData.parameters = { ...params, provider };
    }

    // Generate thumbnails for image outputs (skip videos)
    const generation = await this.prisma.generation.findUnique({
      where: { id: generationId },
      select: { type: true, quantity: true, creditsConsumed: true, userId: true },
    });
    const isImage =
      generation?.type === GenerationType.TEXT_TO_IMAGE ||
      generation?.type === GenerationType.IMAGE_TO_IMAGE;

    let thumbnailUrls: (string | null)[] = result.outputUrls.map(() => null);
    if (isImage) {
      thumbnailUrls = await Promise.all(
        result.outputUrls.map((url, i) =>
          this.uploadsService
            .generateThumbnail(url, `thumbnails/${generationId}`, `thumb_${i}.jpg`)
            .catch(() => null),
        ),
      );
    }

    // Partial refund: if fewer outputs than requested quantity
    const requestedCount = generation?.quantity ?? result.outputUrls.length;
    const actualCount = result.outputUrls.length;
    let creditsRefunded = 0;

    if (actualCount < requestedCount && generation) {
      const costPerUnit = Math.floor(generation.creditsConsumed / requestedCount);
      const missingCount = requestedCount - actualCount;
      creditsRefunded = costPerUnit * missingCount;

      updateData.creditsConsumed = generation.creditsConsumed - creditsRefunded;
    }

    const [updatedGeneration] = await this.prisma.$transaction([
      this.prisma.generation.update({
        where: { id: generationId },
        data: updateData,
      }),
      this.prisma.generationOutput.createMany({
        data: result.outputUrls.map((url, i) => ({
          generationId,
          url,
          thumbnailUrl: thumbnailUrls[i],
          order: i,
        })),
      }),
    ]);

    if (creditsRefunded > 0 && generation) {
      await this.creditsService.partialRefund(
        generation.userId,
        creditsRefunded,
        generationId,
        `Estorno parcial: ${actualCount}/${requestedCount} vídeos gerados`,
      );

      this.logger.log(
        `Partial refund of ${creditsRefunded} credits for generation ${generationId} — ${actualCount}/${requestedCount} outputs`,
      );
    }

    this.generationEvents.emit({
      userId: updatedGeneration.userId,
      generationId,
      status: 'completed',
      data: {
        outputUrls: result.outputUrls,
        processingTimeMs,
        ...(creditsRefunded > 0 && {
          creditsRefunded,
          requestedCount,
          actualCount,
        }),
      },
    });

    this.logger.log(
      `Generation ${generationId} completed in ${processingTimeMs}ms — ${result.outputUrls.length} output(s)`,
    );
  }

  private async handleFailure(
    generationId: string,
    userId: string,
    creditsConsumed: number,
    error: Error,
  ): Promise<void> {
    this.logger.error(
      `Generation ${generationId} failed: ${error.message}`,
      error.stack,
    );

    await this.prisma.generation.update({
      where: { id: generationId },
      data: {
        status: GenerationStatus.FAILED,
        errorMessage: error.message,
        errorCode: 'GENERATION_FAILED',
      },
    });

    await this.creditsService.refund(userId, creditsConsumed, generationId);

    this.generationEvents.emit({
      userId,
      generationId,
      status: 'failed',
      data: {
        errorMessage: error.message,
        errorCode: 'GENERATION_FAILED',
        creditsRefunded: creditsConsumed,
      },
    });

    this.logger.log(
      `Refunded ${creditsConsumed} credits for failed generation ${generationId}`,
    );
  }

  // ─── Read operations ──────────────────────────────────────

  async findById(
    userId: string,
    generationId: string,
  ): Promise<GenerationResponseDto> {
    const generation = await this.prisma.generation.findFirst({
      where: {
        id: generationId,
        userId,
        isDeleted: false,
      },
      include: {
        outputs: { orderBy: { order: 'asc' } },
        inputImages: { orderBy: { order: 'asc' } },
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
        include: {
          outputs: { orderBy: { order: 'asc' } },
          inputImages: { orderBy: { order: 'asc' } },
        },
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

  // ─── Response mapping ─────────────────────────────────────

  private toResponseDto(generation: GenerationWithRelations): GenerationResponseDto {
    return {
      id: generation.id,
      type: generation.type,
      status: generation.status,
      prompt: generation.prompt ?? undefined,
      negativePrompt: generation.negativePrompt ?? undefined,
      resolution: generation.resolution,
      durationSeconds: generation.durationSeconds ?? undefined,
      hasAudio: generation.hasAudio,
      modelUsed: generation.modelUsed ?? undefined,
      parameters:
        (generation.parameters as Record<string, unknown>) ?? undefined,
      outputs: generation.outputs.map((o) => ({
        id: o.id,
        url: o.url,
        thumbnailUrl: o.thumbnailUrl ?? undefined,
        mimeType: o.mimeType ?? undefined,
        order: o.order,
      })),
      inputImages: generation.inputImages.map((img) => ({
        id: img.id,
        role: img.role,
        mimeType: img.mimeType ?? undefined,
        order: img.order,
        referenceType: img.referenceType ?? undefined,
        url: img.url ?? undefined,
      })),
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

  private async uploadBase64Image(
    base64: string,
    mimeType: string,
    generationId: string,
  ): Promise<string> {
    const buffer = Buffer.from(base64, 'base64');
    const ext = mimeType.split('/')[1] ?? 'jpg';
    return this.uploadsService.uploadBuffer(
      buffer,
      `inputs/${generationId}`,
      `input.${ext}`,
      mimeType,
    );
  }

  private async resolveFileUrl(value: string): Promise<string> {
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return value;
    }
    return this.uploadsService.getSignedReadUrl(value);
  }
}
