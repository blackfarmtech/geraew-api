import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { CreditsService } from '../../credits/credits.service';
import { UploadsService } from '../../uploads/uploads.service';
import { GeraewProvider } from '../providers/geraew.provider';
import {
  NanoBananaProvider,
  mapGeminiToNanoBanana,
} from '../providers/nano-banana.provider';
import { WanProvider } from '../providers/wan.provider';
import { GenerationEventsService } from '../generation-events.service';
import { PromptEnhancerService } from '../../prompt-enhancer/prompt-enhancer.service';
import { ContentSafetyError } from '../errors/content-safety.error';
import {
  GenerationStatus,
  GenerationType,
  GenerationImageRole,
} from '@prisma/client';
import {
  GENERATION_QUEUE,
  GenerationJobName,
  ImageJobData,
  ImageNanoBananaJobData,
  TextToVideoJobData,
  ImageToVideoJobData,
  ReferenceVideoJobData,
  MotionControlJobData,
} from './generation-queue.constants';

@Processor(GENERATION_QUEUE, {
  concurrency: 5,
  lockDuration: 15 * 60 * 1000, // 15 min — vídeos podem demorar até 12 min
})
export class GenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(GenerationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly creditsService: CreditsService,
    private readonly uploadsService: UploadsService,
    private readonly geraewProvider: GeraewProvider,
    private readonly nanoBananaProvider: NanoBananaProvider,
    private readonly wanProvider: WanProvider,
    private readonly generationEvents: GenerationEventsService,
    private readonly promptEnhancer: PromptEnhancerService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.logger.log(
      `Processing job ${job.id} [${job.name}] for generation ${job.data.generationId}`,
    );

    switch (job.name) {
      case GenerationJobName.IMAGE:
        return this.processImage(job.data as ImageJobData);
      case GenerationJobName.IMAGE_WITH_FALLBACK:
        return this.processImageWithFallback(job.data as ImageJobData);
      case GenerationJobName.IMAGE_NANO_BANANA:
        return this.processNanoBanana(job.data as ImageNanoBananaJobData);
      case GenerationJobName.TEXT_TO_VIDEO:
        return this.processTextToVideo(job.data as TextToVideoJobData);
      case GenerationJobName.IMAGE_TO_VIDEO:
        return this.processImageToVideo(job.data as ImageToVideoJobData);
      case GenerationJobName.REFERENCE_VIDEO:
        return this.processReferenceVideo(job.data as ReferenceVideoJobData);
      case GenerationJobName.MOTION_CONTROL:
        return this.processMotionControl(job.data as MotionControlJobData);
      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  }

  // ─── Process methods ────────────────────────────────────────

  private async processImage(data: ImageJobData): Promise<void> {
    const startTime = Date.now();
    await this.markProcessingStarted(data.generationId);

    this.logger.log(
      `[IMAGE] ${data.generationId} model=${data.model} resolution=${data.resolution} aspectRatio=${data.aspectRatio} hasInputImages=${data.hasInputImages} prompt="${data.prompt}"`,
    );

    const images = data.hasInputImages
      ? await this.loadInputImagesAsBase64(data.generationId)
      : undefined;

    const result = await this.geraewProvider.generateImage({
      id: data.generationId,
      prompt: data.prompt,
      model: data.model,
      resolution: data.resolution,
      aspectRatio: data.aspectRatio,
      mimeType: data.mimeType,
      images,
    });

    await this.completeGeneration(data.generationId, result, startTime);
  }

  private async processImageWithFallback(data: ImageJobData): Promise<void> {
    const startTime = Date.now();
    await this.markProcessingStarted(data.generationId);

    this.logger.log(
      `[IMAGE_FALLBACK] ${data.generationId} model=${data.model} resolution=${data.resolution} aspectRatio=${data.aspectRatio} hasInputImages=${data.hasInputImages} prompt="${data.prompt}"`,
    );

    const images = data.hasInputImages
      ? await this.loadInputImagesAsBase64(data.generationId)
      : undefined;

    try {
      const result = await this.geraewProvider.generateImage({
        id: data.generationId,
        prompt: data.prompt,
        model: data.model,
        resolution: data.resolution,
        aspectRatio: data.aspectRatio,
        mimeType: data.mimeType,
        images,
      });

      await this.completeGeneration(
        data.generationId,
        result,
        startTime,
        'geraew',
      );
    } catch (geraewError) {
      this.logger.warn(
        `Geraew failed for ${data.generationId}, falling back to Nano Banana: ${(geraewError as Error).message}`,
      );

      // Check if CRON already marked this generation as FAILED — skip KIE to avoid paying for nothing
      const preCheck = await this.prisma.generation.findUnique({
        where: { id: data.generationId },
        select: { status: true },
      });
      if (
        preCheck?.status === GenerationStatus.FAILED ||
        preCheck?.status === GenerationStatus.COMPLETED
      ) {
        this.logger.warn(
          `Generation ${data.generationId} already ${preCheck.status} before Nano Banana fallback — aborting to save KIE costs`,
        );
        return;
      }

      const inputImages = await this.prisma.generationInputImage.findMany({
        where: { generationId: data.generationId },
      });
      const imageUrls = inputImages
        .map((img) => img.url)
        .filter(Boolean) as string[];

      const nanaBananaModel = mapGeminiToNanoBanana(data.model);
      const result = await this.nanoBananaProvider.generateImage({
        id: data.generationId,
        model: nanaBananaModel,
        prompt: data.prompt,
        resolution: data.resolution,
        aspectRatio: data.aspectRatio,
        outputFormat: data.mimeType === 'image/jpeg' ? 'jpg' : 'png',
        imageUrls: imageUrls.length ? imageUrls : undefined,
      });

      await this.completeGeneration(
        data.generationId,
        result,
        startTime,
        nanaBananaModel,
      );
    }
  }

  private async processNanoBanana(data: ImageNanoBananaJobData): Promise<void> {
    const startTime = Date.now();
    await this.markProcessingStarted(data.generationId);

    this.logger.log(
      `[NANO_BANANA] ${data.generationId} model=${data.model} resolution=${data.resolution} aspectRatio=${data.aspectRatio} outputFormat=${data.outputFormat} googleSearch=${data.googleSearch} imageUrls=${data.imageUrls?.length ?? 0} prompt="${data.prompt}"`,
    );

    const result = await this.nanoBananaProvider.generateImage({
      id: data.generationId,
      model: data.model,
      prompt: data.prompt,
      resolution: data.resolution,
      aspectRatio: data.aspectRatio,
      outputFormat: data.outputFormat,
      googleSearch: data.googleSearch,
      imageUrls: data.imageUrls,
    });

    await this.completeGeneration(data.generationId, result, startTime);
  }

  private async processTextToVideo(data: TextToVideoJobData): Promise<void> {
    const startTime = Date.now();
    await this.markProcessingStarted(data.generationId);

    this.logger.log(
      `[TEXT_TO_VIDEO] ${data.generationId} model=${data.model} resolution=${data.resolution} duration=${data.durationSeconds}s aspectRatio=${data.aspectRatio} audio=${data.generateAudio} samples=${data.sampleCount} prompt="${data.prompt}"`,
    );

    const buildInput = (prompt: string) => ({
      id: data.generationId,
      prompt,
      model: data.model,
      resolution: data.resolution,
      durationSeconds: data.durationSeconds,
      aspectRatio: data.aspectRatio,
      generateAudio: data.generateAudio,
      sampleCount: data.sampleCount,
      negativePrompt: data.negativePrompt,
    });

    try {
      const result = await this.geraewProvider.generateTextToVideo(
        buildInput(data.prompt),
      );
      await this.completeGeneration(data.generationId, result, startTime);
    } catch (error) {
      if (this.isSafetyRelatedError(error)) {
        const retryResult = await this.retryWithRefinedPrompt(
          data.generationId,
          data.prompt,
          (refined) => this.geraewProvider.generateTextToVideo(buildInput(refined)),
        );
        if (retryResult) {
          await this.completeGeneration(data.generationId, retryResult, startTime);
          return;
        }
      }
      throw error;
    }
  }

  private async processImageToVideo(data: ImageToVideoJobData): Promise<void> {
    const startTime = Date.now();
    await this.markProcessingStarted(data.generationId);

    this.logger.log(
      `[IMAGE_TO_VIDEO] ${data.generationId} model=${data.resolvedModel} resolution=${data.resolution} duration=${data.durationSeconds}s aspectRatio=${data.aspectRatio} audio=${data.generateAudio} samples=${data.sampleCount} prompt="${data.prompt}"`,
    );

    const inputImages = await this.prisma.generationInputImage.findMany({
      where: { generationId: data.generationId },
      orderBy: { order: 'asc' },
    });

    const firstFrameImg = inputImages.find(
      (img) => img.role === GenerationImageRole.FIRST_FRAME,
    );
    const lastFrameImg = inputImages.find(
      (img) => img.role === GenerationImageRole.LAST_FRAME,
    );

    if (!firstFrameImg?.url) {
      throw new Error('First frame image not found for image-to-video');
    }

    const firstFrameBase64 = await this.downloadToBase64(firstFrameImg.url);
    const lastFrameBase64 = lastFrameImg?.url
      ? await this.downloadToBase64(lastFrameImg.url)
      : undefined;

    const buildInput = (prompt: string) => ({
      id: data.generationId,
      prompt,
      model: data.resolvedModel,
      resolution: data.resolution,
      durationSeconds: data.durationSeconds,
      aspectRatio: data.aspectRatio,
      generateAudio: data.generateAudio,
      sampleCount: data.sampleCount,
      negativePrompt: data.negativePrompt,
      firstFrame: firstFrameBase64,
      firstFrameMimeType: firstFrameImg.mimeType ?? 'image/jpeg',
      lastFrame: lastFrameBase64,
      lastFrameMimeType: lastFrameImg?.mimeType ?? undefined,
    });

    try {
      const result = await this.geraewProvider.generateImageToVideo(
        buildInput(data.prompt),
      );
      await this.completeGeneration(data.generationId, result, startTime);
    } catch (error) {
      if (this.isSafetyRelatedError(error)) {
        const retryResult = await this.retryWithRefinedPrompt(
          data.generationId,
          data.prompt,
          (refined) => this.geraewProvider.generateImageToVideo(buildInput(refined)),
        );
        if (retryResult) {
          await this.completeGeneration(data.generationId, retryResult, startTime);
          return;
        }
      }
      throw error;
    }
  }

  private async processReferenceVideo(
    data: ReferenceVideoJobData,
  ): Promise<void> {
    const startTime = Date.now();
    await this.markProcessingStarted(data.generationId);

    this.logger.log(
      `[REFERENCE_VIDEO] ${data.generationId} model=${data.resolvedModel} resolution=${data.resolution} duration=${data.durationSeconds}s aspectRatio=${data.aspectRatio} audio=${data.generateAudio} samples=${data.sampleCount} prompt="${data.prompt}"`,
    );

    const inputImages = await this.prisma.generationInputImage.findMany({
      where: {
        generationId: data.generationId,
        role: GenerationImageRole.REFERENCE,
      },
      orderBy: { order: 'asc' },
    });

    const referenceImages = await Promise.all(
      inputImages.map(async (img) => ({
        base64: img.url ? await this.downloadToBase64(img.url) : '',
        mimeType: img.mimeType ?? 'image/jpeg',
        referenceType: (img.referenceType ?? 'asset') as 'asset' | 'style',
      })),
    );

    const buildInput = (prompt: string) => ({
      id: data.generationId,
      prompt,
      model: data.resolvedModel,
      resolution: data.resolution,
      durationSeconds: data.durationSeconds,
      aspectRatio: data.aspectRatio,
      generateAudio: data.generateAudio,
      sampleCount: data.sampleCount,
      negativePrompt: data.negativePrompt,
      referenceImages,
    });

    try {
      const result = await this.geraewProvider.generateVideoWithReferences(
        buildInput(data.prompt),
      );
      await this.completeGeneration(data.generationId, result, startTime);
    } catch (error) {
      if (this.isSafetyRelatedError(error)) {
        const retryResult = await this.retryWithRefinedPrompt(
          data.generationId,
          data.prompt,
          (refined) =>
            this.geraewProvider.generateVideoWithReferences(buildInput(refined)),
        );
        if (retryResult) {
          await this.completeGeneration(data.generationId, retryResult, startTime);
          return;
        }
      }
      throw error;
    }
  }

  private async processMotionControl(
    data: MotionControlJobData,
  ): Promise<void> {
    const startTime = Date.now();
    await this.markProcessingStarted(data.generationId);

    this.logger.log(
      `[MOTION_CONTROL] ${data.generationId} resolution=${data.resolution} videoUrl=${data.videoUrl} imageUrl=${data.imageUrl}`,
    );

    const result = await this.wanProvider.generateAnimateReplace({
      id: data.generationId,
      videoUrl: data.videoUrl,
      imageUrl: data.imageUrl,
      resolution: data.resolution,
    });

    await this.completeGeneration(data.generationId, result, startTime);
  }

  // ─── Safety helpers ─────────────────────────────────────────

  private isSafetyRelatedError(error: unknown): boolean {
    if (error instanceof ContentSafetyError) return true;
    if (
      error instanceof Error &&
      error.message.includes('no video data returned')
    ) {
      this.logger.warn(
        `Treating "${error.message}" as potential silent safety block`,
      );
      return true;
    }
    return false;
  }

  // ─── Safety refinement retry ────────────────────────────────

  private async retryWithRefinedPrompt(
    generationId: string,
    originalPrompt: string,
    generateFn: (refinedPrompt: string) => Promise<{ outputUrls: string[]; modelUsed: string }>,
  ): Promise<{ outputUrls: string[]; modelUsed: string } | null> {
    this.logger.warn(
      `Generation ${generationId} blocked by safety filter — attempting prompt refinement`,
    );

    let refinedPrompt: string | null;
    try {
      refinedPrompt = await this.promptEnhancer.refinePromptForSafety(originalPrompt);
    } catch (refineError) {
      this.logger.error(
        `Prompt refinement failed for ${generationId}: ${(refineError as Error).message}`,
      );
      return null;
    }

    if (!refinedPrompt) {
      this.logger.warn(
        `Prompt refinement returned null for ${generationId} — content is unrefinable`,
      );
      return null;
    }

    // Save the refined prompt for audit / user visibility
    await this.prisma.generation.update({
      where: { id: generationId },
      data: {
        parameters: {
          ...(await this.getExistingParameters(generationId)),
          originalPrompt,
          refinedBySafetyAgent: true,
        },
        prompt: refinedPrompt,
      },
    });

    this.logger.log(
      `Retrying generation ${generationId} with refined prompt — original: "${originalPrompt}" → refined: "${refinedPrompt}"`,
    );

    try {
      return await generateFn(refinedPrompt);
    } catch (retryError) {
      this.logger.error(
        `Retry with refined prompt also failed for ${generationId}: ${(retryError as Error).message}`,
      );
      if (this.isSafetyRelatedError(retryError)) {
        throw new ContentSafetyError(
          'A imagem ou texto enviado viola nossas diretrizes de conteúdo mesmo após ajuste automático. Tente reformular sua ideia de forma diferente.',
          retryError instanceof ContentSafetyError
            ? retryError.supportCode
            : undefined,
        );
      }
      throw retryError;
    }
  }

  private async getExistingParameters(
    generationId: string,
  ): Promise<Record<string, unknown>> {
    const gen = await this.prisma.generation.findUnique({
      where: { id: generationId },
      select: { parameters: true },
    });
    return gen?.parameters && typeof gen.parameters === 'object'
      ? (gen.parameters as Record<string, unknown>)
      : {};
  }

  // ─── Shared helpers ─────────────────────────────────────────

  private async markProcessingStarted(generationId: string): Promise<void> {
    await this.prisma.generation.update({
      where: { id: generationId },
      data: { processingStartedAt: new Date() },
    });
  }

  private async completeGeneration(
    generationId: string,
    result: { outputUrls: string[]; modelUsed: string },
    startTime: number,
    provider?: string,
  ): Promise<void> {
    // Idempotency: skip if already completed/failed
    const current = await this.prisma.generation.findUnique({
      where: { id: generationId },
      select: { status: true },
    });
    if (
      current?.status === GenerationStatus.COMPLETED ||
      current?.status === GenerationStatus.FAILED
    ) {
      this.logger.warn(
        `Generation ${generationId} already ${current.status}, skipping completeGeneration`,
      );
      return;
    }

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

    const generation = await this.prisma.generation.findUnique({
      where: { id: generationId },
      select: {
        type: true,
        quantity: true,
        creditsConsumed: true,
        userId: true,
      },
    });

    const isImage =
      generation?.type === GenerationType.TEXT_TO_IMAGE ||
      generation?.type === GenerationType.IMAGE_TO_IMAGE;

    let thumbnailUrls: (string | null)[] = result.outputUrls.map(() => null);
    if (isImage) {
      thumbnailUrls = await Promise.all(
        result.outputUrls.map((url, i) =>
          this.uploadsService
            .generateThumbnail(
              url,
              `thumbnails/${generationId}`,
              `thumb_${i}.jpg`,
            )
            .catch(() => null),
        ),
      );
    }

    const requestedCount = generation?.quantity ?? result.outputUrls.length;
    const actualCount = result.outputUrls.length;
    let creditsRefunded = 0;

    if (actualCount < requestedCount && generation) {
      const costPerUnit = Math.floor(
        generation.creditsConsumed / requestedCount,
      );
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

  @OnWorkerEvent('failed')
  async onFailed(job: Job, error: Error): Promise<void> {
    this.logger.error(
      `Job ${job.id} [${job.name}] failed (attempt ${job.attemptsMade}/${job.opts.attempts ?? 1}): ${error.message}`,
    );

    // Only refund after all retries are exhausted
    if (job.attemptsMade < (job.opts.attempts ?? 1)) {
      this.logger.warn(`Job ${job.id} will be retried`);
      return;
    }

    await this.handleFailure(
      job.data.generationId,
      job.data.userId,
      job.data.creditsConsumed,
      error,
    );
  }

  private async handleFailure(
    generationId: string,
    userId: string,
    creditsConsumed: number,
    error: Error,
  ): Promise<void> {
    // Idempotency: skip if already completed/failed
    const current = await this.prisma.generation.findUnique({
      where: { id: generationId },
      select: { status: true },
    });
    if (
      current?.status === GenerationStatus.COMPLETED ||
      current?.status === GenerationStatus.FAILED
    ) {
      this.logger.warn(
        `Generation ${generationId} already ${current.status}, skipping handleFailure`,
      );
      return;
    }

    const isSafetyError = this.isSafetyRelatedError(error);
    const errorCode = isSafetyError
      ? 'CONTENT_SAFETY_BLOCKED'
      : 'GENERATION_FAILED';

    const userMessage = isSafetyError
      ? 'A imagem ou texto enviado viola nossas diretrizes de conteúdo. Tente reformular seu prompt ou use outra imagem.'
      : error.message;

    this.logger.error(
      `Generation ${generationId} failed (${errorCode}): ${error.message}`,
      error.stack,
    );

    await this.prisma.generation.update({
      where: { id: generationId },
      data: {
        status: GenerationStatus.FAILED,
        errorMessage: userMessage,
        errorCode,
      },
    });

    await this.creditsService.refund(userId, creditsConsumed, generationId);

    this.generationEvents.emit({
      userId,
      generationId,
      status: 'failed',
      data: {
        errorMessage: userMessage,
        errorCode,
        creditsRefunded: creditsConsumed,
      },
    });

    this.logger.log(
      `Refunded ${creditsConsumed} credits for failed generation ${generationId}`,
    );
  }

  private async loadInputImagesAsBase64(
    generationId: string,
  ): Promise<Array<{ base64: string; mimeType: string }>> {
    const inputImages = await this.prisma.generationInputImage.findMany({
      where: { generationId },
      orderBy: { order: 'asc' },
    });

    return Promise.all(
      inputImages
        .filter((img) => img.url)
        .map(async (img) => ({
          base64: await this.downloadToBase64(img.url!),
          mimeType: img.mimeType ?? 'image/png',
        })),
    );
  }

  private async downloadToBase64(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download from S3: ${response.status}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer.toString('base64');
  }
}
