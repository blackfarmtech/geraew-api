import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { CreditsService } from '../credits/credits.service';
import { PlansService } from '../plans/plans.service';
import { ModelsService } from '../models/models.service';
import {
  AiModelType,
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
import { GenerateVideoTextToVideoDto } from './dto/videos/generate-video-text-to-video.dto';
import { GenerateVideoImageToVideoDto } from './dto/videos/generate-video-image-to-video.dto';
import { GenerateVideoWithReferencesDto } from './dto/videos/generate-video-with-references.dto';
import { GenerateMotionControlDto } from './dto/videos/generate-motion-control.dto';
import { getVideoDurationSeconds } from './utils/video-duration.util';
import { GenerateImageDto } from './dto/generate-image.dto';
import { GenerateImageNanoBananaDto } from './dto/generate-image-nano-banana.dto';
import { GenerateVirtualTryOnDto } from './dto/generate-virtual-try-on.dto';
import { GenerateFaceSwapDto } from './dto/generate-face-swap.dto';
import { GenerateVeoKieTextToVideoDto } from './dto/videos/generate-veo-kie-text-to-video.dto';
import { GenerateVeoKieImageToVideoDto } from './dto/videos/generate-veo-kie-image-to-video.dto';
import { GenerateVeoKieReferenceToVideoDto } from './dto/videos/generate-veo-kie-reference-to-video.dto';

/**
 * Mapeia o nome do modelo da API para o modelVariant usado na tabela credit_costs.
 * NBP = gemini-3-pro-image-preview (Nano Banana Pro)
 * NB2 = gemini-3.1-flash-image-preview (Nano Banana 2)
 * GERAEW_FAST = geraew-fast (geraew-provider)
 * GERAEW_QUALITY = geraew-quality (geraew-provider)
 * VEO_FAST = veo3_fast (KIE API)
 * VEO_MAX = veo3 (KIE API)
 */
function getModelVariant(model: string | undefined | null): string | null {
  if (!model) return null;
  const MODEL_TO_VARIANT: Record<string, string> = {
    // Images
    'gemini-3-pro-image-preview': 'NBP',
    'gemini-3.1-flash-image-preview': 'NB2',
    'nano-banana-pro': 'NBP',
    'nano-banana-2': 'NB2',
    // GeraEW provider (video)
    'geraew-fast': 'GERAEW_FAST',
    'geraew-quality': 'GERAEW_QUALITY',
    'veo-3.1-fast-generate-001': 'GERAEW_FAST',  // backward compat
    'veo-3.1-generate-001': 'GERAEW_QUALITY',     // backward compat
    // KIE API (Veo 3.1)
    'veo3_fast': 'VEO_FAST',
    'veo3': 'VEO_MAX',
  };
  return MODEL_TO_VARIANT[model] ?? null;
}

/**
 * Normaliza nomes legados de modelos para os slugs atuais do banco (tabela ai_models).
 * Necessário porque alguns DTOs ainda aceitam nomes antigos do Vertex AI.
 */
function normalizeVideoModelSlug(model: string): string {
  const LEGACY_SLUG_MAP: Record<string, string> = {
    'veo-3.1-fast-generate-001': 'geraew-fast',
    'veo-3.1-generate-001': 'geraew-quality',
  };
  return LEGACY_SLUG_MAP[model] ?? model;
}
import {
  GENERATION_QUEUE,
  GenerationJobName,
  ImageJobData,
  ImageNanoBananaJobData,
  TextToVideoJobData,
  ImageToVideoJobData,
  ReferenceVideoJobData,
  MotionControlJobData,
  VirtualTryOnJobData,
  FaceSwapJobData,
  TextToVideoKieJobData,
  ImageToVideoKieJobData,
  ReferenceToVideoKieJobData,
} from './queue/generation-queue.constants';

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
};

@Injectable()
export class GenerationsService {
  private readonly logger = new Logger(GenerationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly creditsService: CreditsService,
    private readonly plansService: PlansService,
    private readonly uploadsService: UploadsService,
    private readonly modelsService: ModelsService,
    @InjectQueue(GENERATION_QUEUE) private readonly generationQueue: Queue,
  ) { }

  // ─── Image generation (text-to-image / image-to-image) ────

  async generateImage(
    userId: string,
    dto: GenerateImageDto,
  ): Promise<CreateGenerationResponseDto> {
    const type =
      dto.images?.length
        ? GenerationType.IMAGE_TO_IMAGE
        : GenerationType.TEXT_TO_IMAGE;

    const modelVariant = dto.model_variant ?? getModelVariant(dto.model);
    const creditsRequired = await this.plansService.calculateGenerationCost(
      type,
      dto.resolution,
      undefined,
      false,
      1,
      modelVariant,
    );

    await this.checkConcurrentLimit(userId);
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

    await this.generationQueue.add(
      GenerationJobName.IMAGE,
      {
        generationId: generation.id,
        userId,
        creditsConsumed: creditsRequired,
        prompt: dto.prompt,
        model: dto.model,
        resolution: dto.resolution,
        aspectRatio: dto.aspect_ratio,
        mimeType: dto.mime_type,
        hasInputImages: !!dto.images?.length,
      } satisfies ImageJobData,
    );

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

    const modelVariant = dto.model_variant ?? getModelVariant(dto.model);
    const creditsRequired = await this.plansService.calculateGenerationCost(
      type,
      dto.resolution,
      undefined,
      false,
      1,
      modelVariant,
    );

    await this.checkConcurrentLimit(userId);
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

    await this.generationQueue.add(
      GenerationJobName.IMAGE_WITH_FALLBACK,
      {
        generationId: generation.id,
        userId,
        creditsConsumed: creditsRequired,
        prompt: dto.prompt,
        model: dto.model,
        resolution: dto.resolution,
        aspectRatio: dto.aspect_ratio,
        mimeType: dto.mime_type,
        hasInputImages: !!dto.images?.length,
      } satisfies ImageJobData,
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

    const modelVariant = dto.model_variant ?? getModelVariant(dto.model ?? 'nano-banana-2');
    const creditsRequired = await this.plansService.calculateGenerationCost(
      type,
      dto.resolution,
      undefined,
      false,
      1,
      modelVariant,
    );

    await this.checkConcurrentLimit(userId);
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

    await this.generationQueue.add(
      GenerationJobName.IMAGE_NANO_BANANA,
      {
        generationId: generation.id,
        userId,
        creditsConsumed: creditsRequired,
        prompt: dto.prompt,
        model: dto.model ?? 'nano-banana-2',
        resolution: dto.resolution,
        aspectRatio: dto.aspect_ratio,
        outputFormat: dto.output_format,
        googleSearch: dto.google_search,
        imageUrls,
      } satisfies ImageNanoBananaJobData,
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

    const modelVariant = dto.model_variant ?? getModelVariant(dto.model);

    await this.modelsService.assertActiveBySlug(
      normalizeVideoModelSlug(dto.model),
      AiModelType.VIDEO,
    );

    const veoAccess = await this.checkVeoAccess(userId, modelVariant);
    const isFreeGeneration = veoAccess === 'free_generation';

    const creditsRequired = isFreeGeneration
      ? 0
      : await this.plansService.calculateGenerationCost(
          type,
          dto.resolution,
          dto.duration_seconds,
          hasAudio,
          sampleCount,
          modelVariant,
        );

    await this.checkConcurrentLimit(userId);

    if (!isFreeGeneration) {
      await this.ensureSufficientBalance(userId, creditsRequired);
    }

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
        usedFreeGeneration: isFreeGeneration,
      },
    });

    if (isFreeGeneration) {
      await this.creditsService.consumeFreeVeoGeneration(userId, generation.id);
    } else {
      await this.debitCredits(userId, creditsRequired, generation.id, type, dto.resolution);
    }

    await this.generationQueue.add(
      GenerationJobName.TEXT_TO_VIDEO,
      {
        generationId: generation.id,
        userId,
        creditsConsumed: creditsRequired,
        usedFreeGeneration: isFreeGeneration,
        prompt: dto.prompt,
        model: dto.model,
        resolution: dto.resolution,
        durationSeconds: dto.duration_seconds,
        aspectRatio: dto.aspect_ratio,
        generateAudio: hasAudio,
        sampleCount,
        negativePrompt: dto.negative_prompt,
      } satisfies TextToVideoJobData,
    );

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
    const model = dto.model ?? 'veo-3.1-generate-001';
    const hasAudio = dto.generate_audio ?? true;

    const sampleCount = dto.sample_count ?? 1;

    const modelVariant = dto.model_variant ?? getModelVariant(model);

    await this.modelsService.assertActiveBySlug(
      normalizeVideoModelSlug(model),
      AiModelType.VIDEO,
    );

    const veoAccess = await this.checkVeoAccess(userId, modelVariant);
    const isFreeGeneration = veoAccess === 'free_generation';

    const creditsRequired = isFreeGeneration
      ? 0
      : await this.plansService.calculateGenerationCost(
          type,
          dto.resolution,
          dto.duration_seconds,
          hasAudio,
          sampleCount,
          modelVariant,
        );

    await this.checkConcurrentLimit(userId);

    if (!isFreeGeneration) {
      await this.ensureSufficientBalance(userId, creditsRequired);
    }

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
        usedFreeGeneration: isFreeGeneration,
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

    if (isFreeGeneration) {
      await this.creditsService.consumeFreeVeoGeneration(userId, generation.id);
    } else {
      await this.debitCredits(userId, creditsRequired, generation.id, type, dto.resolution);
    }

    await this.generationQueue.add(
      GenerationJobName.IMAGE_TO_VIDEO,
      {
        generationId: generation.id,
        userId,
        creditsConsumed: creditsRequired,
        usedFreeGeneration: isFreeGeneration,
        prompt: dto.prompt,
        model: dto.model ?? model,
        resolution: dto.resolution,
        durationSeconds: dto.duration_seconds,
        aspectRatio: dto.aspect_ratio,
        generateAudio: hasAudio,
        sampleCount,
        negativePrompt: dto.negative_prompt,
        resolvedModel: model,
      } satisfies ImageToVideoJobData,
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
    const model = dto.model ?? 'veo-3.1-generate-001';
    const hasAudio = dto.generate_audio ?? true;

    const sampleCount = dto.sample_count ?? 1;

    const modelVariant = dto.model_variant ?? getModelVariant(model);

    await this.modelsService.assertActiveBySlug(
      normalizeVideoModelSlug(model),
      AiModelType.VIDEO,
    );

    const veoAccess = await this.checkVeoAccess(userId, modelVariant);
    const isFreeGeneration = veoAccess === 'free_generation';

    const creditsRequired = isFreeGeneration
      ? 0
      : await this.plansService.calculateGenerationCost(
          type,
          dto.resolution,
          dto.duration_seconds,
          hasAudio,
          sampleCount,
          modelVariant,
        );

    await this.checkConcurrentLimit(userId);

    if (!isFreeGeneration) {
      await this.ensureSufficientBalance(userId, creditsRequired);
    }

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
        usedFreeGeneration: isFreeGeneration,
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

    if (isFreeGeneration) {
      await this.creditsService.consumeFreeVeoGeneration(userId, generation.id);
    } else {
      await this.debitCredits(userId, creditsRequired, generation.id, type, dto.resolution);
    }

    await this.generationQueue.add(
      GenerationJobName.REFERENCE_VIDEO,
      {
        generationId: generation.id,
        userId,
        creditsConsumed: creditsRequired,
        usedFreeGeneration: isFreeGeneration,
        prompt: dto.prompt,
        model: dto.model ?? model,
        resolution: dto.resolution,
        durationSeconds: dto.duration_seconds,
        aspectRatio: dto.aspect_ratio,
        generateAudio: hasAudio,
        sampleCount,
        negativePrompt: dto.negative_prompt,
        resolvedModel: model,
      } satisfies ReferenceVideoJobData,
    );

    return {
      id: generation.id,
      status: GenerationStatus.PROCESSING,
      creditsConsumed: creditsRequired,
    };
  }

  // ─── Motion Control (Kling 2.6) ───────────────────────────

  async generateMotionControl(
    userId: string,
    dto: GenerateMotionControlDto,
  ): Promise<CreateGenerationResponseDto> {
    const type = GenerationType.MOTION_CONTROL;
    const resolution = dto.resolution ?? '720p';
    const dbResolution = resolution === '1080p' ? Resolution.RES_1080P : Resolution.RES_720P;

    const videoBuffer = Buffer.from(dto.video, 'base64');
    const durationSeconds = getVideoDurationSeconds(videoBuffer);

    const creditsRequired = await this.plansService.calculateGenerationCost(
      type,
      dbResolution,
      durationSeconds,
      false,
    );

    await this.checkConcurrentLimit(userId);
    await this.ensureSufficientBalance(userId, creditsRequired);

    const generation = await this.prisma.generation.create({
      data: {
        userId,
        type,
        status: GenerationStatus.PROCESSING,
        modelUsed: 'kling-2.6/motion-control',
        resolution: dbResolution,
        durationSeconds,
        hasAudio: false,
        creditsConsumed: creditsRequired,
        parameters: { resolution },
      },
    });

    // Upload video to S3 — public URL for Wan API, signed URL for internal display
    const videoMime = dto.video_mime_type ?? 'video/mp4';
    const videoExt = videoMime === 'video/quicktime' ? 'mov' : videoMime === 'video/x-matroska' ? 'mkv' : 'mp4';
    const { publicUrl: videoPublicUrl, signedUrl: videoSignedUrl } =
      await this.uploadsService.uploadBufferPublic(
        videoBuffer,
        `inputs/${generation.id}`,
        `input_video.${videoExt}`,
        videoMime,
      );

    // Upload image to S3 — public URL for Wan API, signed URL for internal display
    const imageMime = dto.image_mime_type ?? 'image/jpeg';
    const imageExt = imageMime === 'image/png' ? 'png' : imageMime === 'image/webp' ? 'webp' : 'jpg';
    const imageBuffer = Buffer.from(dto.image, 'base64');
    const { publicUrl: imagePublicUrl, signedUrl: imageSignedUrl } =
      await this.uploadsService.uploadBufferPublic(
        imageBuffer,
        `inputs/${generation.id}`,
        `input_image.${imageExt}`,
        imageMime,
      );

    // Save input images for reference (signed URLs for internal display)
    await this.prisma.generationInputImage.createMany({
      data: [
        {
          generationId: generation.id,
          role: GenerationImageRole.REFERENCE,
          mimeType: videoMime,
          order: 0,
          url: videoSignedUrl,
        },
        {
          generationId: generation.id,
          role: GenerationImageRole.REFERENCE,
          mimeType: imageMime,
          order: 1,
          url: imageSignedUrl,
        },
      ],
    });

    await this.debitCredits(userId, creditsRequired, generation.id, type, dbResolution);

    await this.generationQueue.add(
      GenerationJobName.MOTION_CONTROL,
      {
        generationId: generation.id,
        userId,
        creditsConsumed: creditsRequired,
        videoUrl: videoPublicUrl,
        imageUrl: imagePublicUrl,
        resolution,
      } satisfies MotionControlJobData,
    );

    return {
      id: generation.id,
      status: GenerationStatus.PROCESSING,
      creditsConsumed: creditsRequired,
    };
  }

  // ─── Virtual Try-On ──────────────────────────────────────

  async generateVirtualTryOn(
    userId: string,
    dto: GenerateVirtualTryOnDto,
  ): Promise<CreateGenerationResponseDto> {
    const type = GenerationType.VIRTUAL_TRY_ON;
    const model = dto.model ?? 'gemini-3.1-flash-image-preview';
    const resolution = dto.resolution ?? Resolution.RES_2K;

    const modelVariant = dto.model_variant ?? getModelVariant(model);
    const creditsRequired = await this.plansService.calculateGenerationCost(
      type,
      resolution,
      undefined,
      false,
      1,
      modelVariant,
    );

    await this.checkConcurrentLimit(userId);
    await this.ensureSufficientBalance(userId, creditsRequired);

    const prompt = this.buildVirtualTryOnPrompt(dto.additional_instructions);

    const generation = await this.prisma.generation.create({
      data: {
        userId,
        type,
        status: GenerationStatus.PROCESSING,
        prompt,
        modelUsed: model,
        resolution,
        aspectRatio: dto.aspect_ratio ?? '3:4',
        hasAudio: false,
        creditsConsumed: creditsRequired,
        parameters: {
          feature: 'virtual_try_on',
          mimeType: dto.output_mime_type ?? 'image/png',
        },
      },
    });

    // Upload influencer image
    const influencerUrl = await this.uploadBase64Image(
      dto.influencer_image,
      dto.influencer_image_mime_type ?? 'image/png',
      generation.id,
    );

    // Upload clothing image
    const clothingUrl = await this.uploadBase64Image(
      dto.clothing_image,
      dto.clothing_image_mime_type ?? 'image/png',
      generation.id,
    );

    await this.prisma.generationInputImage.createMany({
      data: [
        {
          generationId: generation.id,
          role: GenerationImageRole.REFERENCE,
          mimeType: dto.influencer_image_mime_type ?? 'image/png',
          order: 0,
          url: influencerUrl,
        },
        {
          generationId: generation.id,
          role: GenerationImageRole.REFERENCE,
          mimeType: dto.clothing_image_mime_type ?? 'image/png',
          order: 1,
          url: clothingUrl,
        },
      ],
    });

    await this.debitCredits(userId, creditsRequired, generation.id, type, resolution);

    await this.generationQueue.add(
      GenerationJobName.VIRTUAL_TRY_ON,
      {
        generationId: generation.id,
        userId,
        creditsConsumed: creditsRequired,
        prompt,
        model,
        resolution,
        aspectRatio: dto.aspect_ratio ?? '3:4',
        mimeType: dto.output_mime_type ?? 'image/png',
      } satisfies VirtualTryOnJobData,
    );

    return {
      id: generation.id,
      status: GenerationStatus.PROCESSING,
      creditsConsumed: creditsRequired,
    };
  }

  private buildVirtualTryOnPrompt(additionalInstructions?: string): string {
    let prompt = `Virtual try-on: Using the provided images, dress the person from the first image (the model/influencer) in the exact clothing item shown in the second image.

CRITICAL REQUIREMENTS:
- The person's face, body proportions, skin tone, hair, and overall appearance MUST remain exactly the same — do NOT alter them.
- The clothing from the second image must be placed naturally on the person's body, respecting the body's pose, proportions, and perspective.
- Preserve the exact design, color, pattern, texture, and style of the clothing item. Do not modify, simplify, or reinterpret the garment.
- The clothing must fit naturally on the body — proper draping, folds, and shadows that match the body's pose and lighting.
- Maintain the lighting, shadows, and overall photographic quality of the original person image.
- The result should look like a real, high-quality photograph — not a collage or digital overlay.
- Keep the background and environment from the first image (the person's photo).`;

    if (additionalInstructions) {
      prompt += `\n\nAdditional instructions: ${additionalInstructions}`;
    }

    return prompt;
  }

  // ─── Face Swap ──────────────────────────────────────────

  async generateFaceSwap(
    userId: string,
    dto: GenerateFaceSwapDto,
  ): Promise<CreateGenerationResponseDto> {
    const type = GenerationType.FACE_SWAP;
    const resolutionMap: Record<string, Resolution> = {
      '1K': Resolution.RES_1K,
      '2K': Resolution.RES_2K,
      '4K': Resolution.RES_4K,
    };
    const resolution = resolutionMap[dto.resolution ?? '2K'] ?? Resolution.RES_2K;

    const modelVariant = getModelVariant('nano-banana-2');
    const creditsRequired = await this.plansService.calculateGenerationCost(
      type,
      resolution,
      undefined,
      false,
      1,
      modelVariant,
    );

    await this.checkConcurrentLimit(userId);
    await this.ensureSufficientBalance(userId, creditsRequired);

    const generation = await this.prisma.generation.create({
      data: {
        userId,
        type,
        status: GenerationStatus.PROCESSING,
        prompt: 'Face Swap',
        modelUsed: 'nano-banana-2',
        resolution,
        hasAudio: false,
        creditsConsumed: creditsRequired,
        parameters: { feature: 'face_swap' },
      },
    });

    // Upload source image (face)
    const sourceUrl = await this.uploadBase64Image(
      dto.source_image,
      dto.source_image_mime_type ?? 'image/jpeg',
      generation.id,
    );

    // Upload target image (scene/body)
    const targetUrl = await this.uploadBase64Image(
      dto.target_image,
      dto.target_image_mime_type ?? 'image/jpeg',
      generation.id,
    );

    await this.prisma.generationInputImage.createMany({
      data: [
        {
          generationId: generation.id,
          role: GenerationImageRole.REFERENCE,
          mimeType: dto.source_image_mime_type ?? 'image/jpeg',
          order: 0,
          url: sourceUrl,
        },
        {
          generationId: generation.id,
          role: GenerationImageRole.REFERENCE,
          mimeType: dto.target_image_mime_type ?? 'image/jpeg',
          order: 1,
          url: targetUrl,
        },
      ],
    });

    await this.debitCredits(userId, creditsRequired, generation.id, type, resolution);

    await this.generationQueue.add(
      GenerationJobName.FACE_SWAP,
      {
        generationId: generation.id,
        userId,
        creditsConsumed: creditsRequired,
        sourceImageUrl: sourceUrl,
        targetImageUrl: targetUrl,
        resolution: dto.resolution ?? '2K',
      } satisfies FaceSwapJobData,
    );

    return {
      id: generation.id,
      status: GenerationStatus.PROCESSING,
      creditsConsumed: creditsRequired,
    };
  }

  // ─── Kie Veo — Text to Video ─────────────────────────────

  async generateTextToVideoKie(
    userId: string,
    dto: GenerateVeoKieTextToVideoDto,
  ): Promise<CreateGenerationResponseDto> {
    const type = GenerationType.TEXT_TO_VIDEO;
    const model = dto.model ?? 'veo3_fast';
    const hasAudio = dto.generate_audio ?? true;

    const modelVariant = dto.model_variant ?? getModelVariant(model);

    await this.modelsService.assertActiveBySlug(model, AiModelType.VIDEO);

    const veoAccess = await this.checkVeoAccess(userId, modelVariant, 'kie');
    const isFreeGeneration = veoAccess === 'free_generation';

    const creditsRequired = isFreeGeneration
      ? 0
      : await this.plansService.calculateGenerationCost(
          type,
          dto.resolution,
          undefined,
          hasAudio,
          1,
          modelVariant,
        );

    await this.checkConcurrentLimit(userId);

    if (!isFreeGeneration) {
      await this.ensureSufficientBalance(userId, creditsRequired);
    }

    const generation = await this.prisma.generation.create({
      data: {
        userId,
        type,
        status: GenerationStatus.PROCESSING,
        prompt: dto.prompt,
        modelUsed: model,
        resolution: dto.resolution,
        hasAudio,
        aspectRatio: dto.aspect_ratio,
        creditsConsumed: creditsRequired,
        usedFreeGeneration: isFreeGeneration,
        parameters: { provider: 'kie', seed: dto.seed },
      },
    });

    if (isFreeGeneration) {
      await this.creditsService.consumeFreeVeoGeneration(userId, generation.id);
    } else {
      await this.debitCredits(userId, creditsRequired, generation.id, type, dto.resolution);
    }

    await this.generationQueue.add(
      GenerationJobName.TEXT_TO_VIDEO_KIE,
      {
        generationId: generation.id,
        userId,
        creditsConsumed: creditsRequired,
        usedFreeGeneration: isFreeGeneration,
        prompt: dto.prompt,
        model,
        resolution: dto.resolution,
        aspectRatio: dto.aspect_ratio,
        generateAudio: hasAudio,
        seed: dto.seed,
      } satisfies TextToVideoKieJobData,
    );

    return {
      id: generation.id,
      status: GenerationStatus.PROCESSING,
      creditsConsumed: creditsRequired,
    };
  }

  // ─── Kie Veo — Image to Video ──────────────────────────────

  async generateImageToVideoKie(
    userId: string,
    dto: GenerateVeoKieImageToVideoDto,
  ): Promise<CreateGenerationResponseDto> {
    const type = GenerationType.IMAGE_TO_VIDEO;
    const model = dto.model ?? 'veo3_fast';
    const hasAudio = dto.generate_audio ?? true;

    const modelVariant = dto.model_variant ?? getModelVariant(model);

    await this.modelsService.assertActiveBySlug(model, AiModelType.VIDEO);

    const veoAccess = await this.checkVeoAccess(userId, modelVariant, 'kie');
    const isFreeGeneration = veoAccess === 'free_generation';

    const creditsRequired = isFreeGeneration
      ? 0
      : await this.plansService.calculateGenerationCost(
          type,
          dto.resolution,
          undefined,
          hasAudio,
          1,
          modelVariant,
        );

    await this.checkConcurrentLimit(userId);

    if (!isFreeGeneration) {
      await this.ensureSufficientBalance(userId, creditsRequired);
    }

    const generation = await this.prisma.generation.create({
      data: {
        userId,
        type,
        status: GenerationStatus.PROCESSING,
        prompt: dto.prompt,
        modelUsed: model,
        resolution: dto.resolution,
        hasAudio,
        aspectRatio: dto.aspect_ratio,
        creditsConsumed: creditsRequired,
        usedFreeGeneration: isFreeGeneration,
        parameters: { provider: 'kie', seed: dto.seed },
      },
    });

    // Upload frames to S3 and get public URLs for Kie API
    const firstFrameUrl = await this.uploadBase64ImagePublic(
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

    const imageUrls: string[] = [firstFrameUrl];

    if (dto.last_frame) {
      const lastFrameUrl = await this.uploadBase64ImagePublic(
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
      imageUrls.push(lastFrameUrl);
    }

    await this.prisma.generationInputImage.createMany({ data: inputImageData });

    if (isFreeGeneration) {
      await this.creditsService.consumeFreeVeoGeneration(userId, generation.id);
    } else {
      await this.debitCredits(userId, creditsRequired, generation.id, type, dto.resolution);
    }

    await this.generationQueue.add(
      GenerationJobName.IMAGE_TO_VIDEO_KIE,
      {
        generationId: generation.id,
        userId,
        creditsConsumed: creditsRequired,
        usedFreeGeneration: isFreeGeneration,
        prompt: dto.prompt,
        model,
        resolution: dto.resolution,
        aspectRatio: dto.aspect_ratio,
        generateAudio: hasAudio,
        seed: dto.seed,
        imageUrls,
      } satisfies ImageToVideoKieJobData,
    );

    return {
      id: generation.id,
      status: GenerationStatus.PROCESSING,
      creditsConsumed: creditsRequired,
    };
  }

  // ─── Kie Veo — Reference to Video ───────────────────────────

  async generateReferenceToVideoKie(
    userId: string,
    dto: GenerateVeoKieReferenceToVideoDto,
  ): Promise<CreateGenerationResponseDto> {
    const type = GenerationType.IMAGE_TO_VIDEO;
    const model = 'veo3_fast'; // REFERENCE_2_VIDEO only supports veo3_fast
    const hasAudio = dto.generate_audio ?? true;

    const modelVariant = dto.model_variant ?? 'VEO_FAST';

    await this.modelsService.assertActiveBySlug(model, AiModelType.VIDEO);

    const veoAccess = await this.checkVeoAccess(userId, modelVariant, 'kie');
    const isFreeGeneration = veoAccess === 'free_generation';

    const creditsRequired = isFreeGeneration
      ? 0
      : await this.plansService.calculateGenerationCost(
          type,
          dto.resolution,
          undefined,
          hasAudio,
          1,
          modelVariant,
        );

    await this.checkConcurrentLimit(userId);

    if (!isFreeGeneration) {
      await this.ensureSufficientBalance(userId, creditsRequired);
    }

    const generation = await this.prisma.generation.create({
      data: {
        userId,
        type,
        status: GenerationStatus.PROCESSING,
        prompt: dto.prompt,
        modelUsed: model,
        resolution: dto.resolution,
        hasAudio,
        aspectRatio: dto.aspect_ratio,
        creditsConsumed: creditsRequired,
        usedFreeGeneration: isFreeGeneration,
        parameters: { provider: 'kie', seed: dto.seed, generationType: 'REFERENCE_2_VIDEO' },
      },
    });

    // Upload reference images to S3 and get public URLs for Kie API
    const mimeTypes = dto.reference_images_mime_types ?? [];
    const imageUrls: string[] = [];

    for (let i = 0; i < dto.reference_images.length; i++) {
      const mime = mimeTypes[i] ?? 'image/jpeg';
      const publicUrl = await this.uploadBase64ImagePublic(
        dto.reference_images[i],
        mime,
        generation.id,
      );
      imageUrls.push(publicUrl);
    }

    await this.prisma.generationInputImage.createMany({
      data: dto.reference_images.map((_, i) => ({
        generationId: generation.id,
        role: GenerationImageRole.REFERENCE,
        mimeType: mimeTypes[i] ?? 'image/jpeg',
        order: i,
        url: imageUrls[i],
      })),
    });

    if (isFreeGeneration) {
      await this.creditsService.consumeFreeVeoGeneration(userId, generation.id);
    } else {
      await this.debitCredits(userId, creditsRequired, generation.id, type, dto.resolution);
    }

    await this.generationQueue.add(
      GenerationJobName.REFERENCE_TO_VIDEO_KIE,
      {
        generationId: generation.id,
        userId,
        creditsConsumed: creditsRequired,
        usedFreeGeneration: isFreeGeneration,
        prompt: dto.prompt,
        model,
        resolution: dto.resolution,
        aspectRatio: dto.aspect_ratio,
        generateAudio: hasAudio,
        seed: dto.seed,
        imageUrls,
      } satisfies ReferenceToVideoKieJobData,
    );

    return {
      id: generation.id,
      status: GenerationStatus.PROCESSING,
      creditsConsumed: creditsRequired,
    };
  }

  // ─── Shared helpers ───────────────────────────────────────

  private async checkVeoAccess(
    userId: string,
    modelVariant: string | null,
    provider: 'geraew' | 'kie' = 'geraew',
  ): Promise<'paid' | 'free_generation'> {
    const isGeraew = modelVariant === 'GERAEW_FAST' || modelVariant === 'GERAEW_QUALITY';
    const isVeo = modelVariant === 'VEO_FAST' || modelVariant === 'VEO_MAX';

    if (!isGeraew && !isVeo) {
      return 'paid';
    }

    // Free generations (2 iniciais) → apenas GeraEW provider
    if (provider === 'geraew') {
      const hasFree = await this.creditsService.hasFreeVeoGenerations(userId);
      if (hasFree) {
        return 'free_generation';
      }
    }

    // Com créditos → qualquer provider, sem restrição de plano
    return 'paid';
  }

  private async checkConcurrentLimit(userId: string): Promise<void> {
    const [processingCount, subscription] = await Promise.all([
      this.prisma.generation.count({
        where: { userId, status: GenerationStatus.PROCESSING },
      }),
      this.prisma.subscription.findFirst({
        where: { userId, status: 'ACTIVE' },
        select: { plan: { select: { maxConcurrentGenerations: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const maxConcurrent = subscription?.plan.maxConcurrentGenerations ?? 5;

    if (processingCount >= maxConcurrent) {
      throw new HttpException(
        {
          code: 'MAX_CONCURRENT_REACHED',
          message: `Limite de ${maxConcurrent} geração(ões) simultânea(s) atingido. Aguarde uma geração concluir antes de iniciar outra.`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

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
      },
    });

    if (!generation) {
      throw new NotFoundException('Geração não encontrada');
    }

    return this.toResponseDto(generation);
  }

  async findFolders(userId: string, generationId: string) {
    const generation = await this.prisma.generation.findFirst({
      where: { id: generationId, userId, isDeleted: false },
      select: { id: true },
    });

    if (!generation) {
      throw new NotFoundException('Geração não encontrada');
    }

    const generationFolders = await this.prisma.generationFolder.findMany({
      where: { generationId },
      include: {
        folder: {
          include: { _count: { select: { generationFolders: true } } },
        },
      },
    });

    return generationFolders.map((gf) => ({
      id: gf.folder.id,
      name: gf.folder.name,
      description: gf.folder.description ?? undefined,
      generationCount: gf.folder._count.generationFolders,
      createdAt: gf.folder.createdAt,
      updatedAt: gf.folder.updatedAt,
    }));
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
      const mappedField = fieldMap[field];
      if (mappedField) {
        orderBy = { [mappedField]: direction === 'asc' ? 'asc' : 'desc' };
      }
      // If field not in map, keep default orderBy (createdAt desc)
    }

    const [generations, total] = await Promise.all([
      this.prisma.generation.findMany({
        where,
        orderBy,
        skip: filters.skip,
        take: filters.limit,
        include: {
          outputs: { orderBy: { order: 'asc' } },
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

  async deleteOutput(
    userId: string,
    generationId: string,
    outputId: string,
  ): Promise<void> {
    const generation = await this.prisma.generation.findFirst({
      where: { id: generationId, userId },
      include: { outputs: { select: { id: true } } },
    });

    if (!generation) {
      throw new NotFoundException('Geração não encontrada');
    }

    const output = generation.outputs.find((o) => o.id === outputId);
    if (!output) {
      throw new NotFoundException('Output não encontrado nesta geração');
    }

    await this.prisma.generationOutput.delete({
      where: { id: outputId },
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
      inputImages: [],
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

  private async uploadBase64ImagePublic(
    base64: string,
    mimeType: string,
    generationId: string,
  ): Promise<string> {
    const buffer = Buffer.from(base64, 'base64');
    const ext = mimeType.split('/')[1] ?? 'jpg';
    const { publicUrl } = await this.uploadsService.uploadBufferPublic(
      buffer,
      `inputs/${generationId}`,
      `input_${Date.now()}.${ext}`,
      mimeType,
    );
    return publicUrl;
  }
}
