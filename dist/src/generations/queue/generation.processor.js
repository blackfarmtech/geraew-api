"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var GenerationProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenerationProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const bullmq_2 = require("bullmq");
const prisma_service_1 = require("../../prisma/prisma.service");
const credits_service_1 = require("../../credits/credits.service");
const uploads_service_1 = require("../../uploads/uploads.service");
const geraew_provider_1 = require("../providers/geraew.provider");
const nano_banana_provider_1 = require("../providers/nano-banana.provider");
const wan_provider_1 = require("../providers/wan.provider");
const generation_events_service_1 = require("../generation-events.service");
const client_1 = require("@prisma/client");
const generation_queue_constants_1 = require("./generation-queue.constants");
let GenerationProcessor = GenerationProcessor_1 = class GenerationProcessor extends bullmq_1.WorkerHost {
    prisma;
    creditsService;
    uploadsService;
    geraewProvider;
    nanoBananaProvider;
    wanProvider;
    generationEvents;
    logger = new common_1.Logger(GenerationProcessor_1.name);
    constructor(prisma, creditsService, uploadsService, geraewProvider, nanoBananaProvider, wanProvider, generationEvents) {
        super();
        this.prisma = prisma;
        this.creditsService = creditsService;
        this.uploadsService = uploadsService;
        this.geraewProvider = geraewProvider;
        this.nanoBananaProvider = nanoBananaProvider;
        this.wanProvider = wanProvider;
        this.generationEvents = generationEvents;
    }
    async process(job) {
        this.logger.log(`Processing job ${job.id} [${job.name}] for generation ${job.data.generationId}`);
        switch (job.name) {
            case generation_queue_constants_1.GenerationJobName.IMAGE:
                return this.processImage(job.data);
            case generation_queue_constants_1.GenerationJobName.IMAGE_WITH_FALLBACK:
                return this.processImageWithFallback(job.data);
            case generation_queue_constants_1.GenerationJobName.IMAGE_NANO_BANANA:
                return this.processNanoBanana(job.data);
            case generation_queue_constants_1.GenerationJobName.TEXT_TO_VIDEO:
                return this.processTextToVideo(job.data);
            case generation_queue_constants_1.GenerationJobName.IMAGE_TO_VIDEO:
                return this.processImageToVideo(job.data);
            case generation_queue_constants_1.GenerationJobName.REFERENCE_VIDEO:
                return this.processReferenceVideo(job.data);
            case generation_queue_constants_1.GenerationJobName.MOTION_CONTROL:
                return this.processMotionControl(job.data);
            default:
                throw new Error(`Unknown job name: ${job.name}`);
        }
    }
    async processImage(data) {
        const startTime = Date.now();
        await this.markProcessingStarted(data.generationId);
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
    async processImageWithFallback(data) {
        const startTime = Date.now();
        await this.markProcessingStarted(data.generationId);
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
            await this.completeGeneration(data.generationId, result, startTime, 'geraew');
        }
        catch (geraewError) {
            this.logger.warn(`Geraew failed for ${data.generationId}, falling back to Nano Banana: ${geraewError.message}`);
            const inputImages = await this.prisma.generationInputImage.findMany({
                where: { generationId: data.generationId },
            });
            const imageUrls = inputImages
                .map((img) => img.url)
                .filter(Boolean);
            const nanaBananaModel = (0, nano_banana_provider_1.mapGeminiToNanoBanana)(data.model);
            const result = await this.nanoBananaProvider.generateImage({
                id: data.generationId,
                model: nanaBananaModel,
                prompt: data.prompt,
                resolution: data.resolution,
                aspectRatio: data.aspectRatio,
                outputFormat: data.mimeType === 'image/jpeg' ? 'jpg' : 'png',
                imageUrls: imageUrls.length ? imageUrls : undefined,
            });
            await this.completeGeneration(data.generationId, result, startTime, nanaBananaModel);
        }
    }
    async processNanoBanana(data) {
        const startTime = Date.now();
        await this.markProcessingStarted(data.generationId);
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
    async processTextToVideo(data) {
        const startTime = Date.now();
        await this.markProcessingStarted(data.generationId);
        const result = await this.geraewProvider.generateTextToVideo({
            id: data.generationId,
            prompt: data.prompt,
            model: data.model,
            resolution: data.resolution,
            durationSeconds: data.durationSeconds,
            aspectRatio: data.aspectRatio,
            generateAudio: data.generateAudio,
            sampleCount: data.sampleCount,
            negativePrompt: data.negativePrompt,
        });
        await this.completeGeneration(data.generationId, result, startTime);
    }
    async processImageToVideo(data) {
        const startTime = Date.now();
        await this.markProcessingStarted(data.generationId);
        const inputImages = await this.prisma.generationInputImage.findMany({
            where: { generationId: data.generationId },
            orderBy: { order: 'asc' },
        });
        const firstFrameImg = inputImages.find((img) => img.role === client_1.GenerationImageRole.FIRST_FRAME);
        const lastFrameImg = inputImages.find((img) => img.role === client_1.GenerationImageRole.LAST_FRAME);
        if (!firstFrameImg?.url) {
            throw new Error('First frame image not found for image-to-video');
        }
        const firstFrameBase64 = await this.downloadToBase64(firstFrameImg.url);
        const lastFrameBase64 = lastFrameImg?.url
            ? await this.downloadToBase64(lastFrameImg.url)
            : undefined;
        const result = await this.geraewProvider.generateImageToVideo({
            id: data.generationId,
            prompt: data.prompt,
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
        await this.completeGeneration(data.generationId, result, startTime);
    }
    async processReferenceVideo(data) {
        const startTime = Date.now();
        await this.markProcessingStarted(data.generationId);
        const inputImages = await this.prisma.generationInputImage.findMany({
            where: {
                generationId: data.generationId,
                role: client_1.GenerationImageRole.REFERENCE,
            },
            orderBy: { order: 'asc' },
        });
        const referenceImages = await Promise.all(inputImages.map(async (img) => ({
            base64: img.url ? await this.downloadToBase64(img.url) : '',
            mimeType: img.mimeType ?? 'image/jpeg',
            referenceType: (img.referenceType ?? 'asset'),
        })));
        const result = await this.geraewProvider.generateVideoWithReferences({
            id: data.generationId,
            prompt: data.prompt,
            model: data.resolvedModel,
            resolution: data.resolution,
            durationSeconds: data.durationSeconds,
            aspectRatio: data.aspectRatio,
            generateAudio: data.generateAudio,
            sampleCount: data.sampleCount,
            negativePrompt: data.negativePrompt,
            referenceImages,
        });
        await this.completeGeneration(data.generationId, result, startTime);
    }
    async processMotionControl(data) {
        const startTime = Date.now();
        await this.markProcessingStarted(data.generationId);
        const result = await this.wanProvider.generateAnimateReplace({
            id: data.generationId,
            videoUrl: data.videoUrl,
            imageUrl: data.imageUrl,
            resolution: data.wanResolution,
        });
        await this.completeGeneration(data.generationId, result, startTime);
    }
    async markProcessingStarted(generationId) {
        await this.prisma.generation.update({
            where: { id: generationId },
            data: { processingStartedAt: new Date() },
        });
    }
    async completeGeneration(generationId, result, startTime, provider) {
        const current = await this.prisma.generation.findUnique({
            where: { id: generationId },
            select: { status: true },
        });
        if (current?.status === client_1.GenerationStatus.COMPLETED ||
            current?.status === client_1.GenerationStatus.FAILED) {
            this.logger.warn(`Generation ${generationId} already ${current.status}, skipping completeGeneration`);
            return;
        }
        const processingTimeMs = Date.now() - startTime;
        const updateData = {
            status: client_1.GenerationStatus.COMPLETED,
            modelUsed: result.modelUsed,
            processingTimeMs,
            completedAt: new Date(),
        };
        if (provider) {
            const existing = await this.prisma.generation.findUnique({
                where: { id: generationId },
                select: { parameters: true },
            });
            const params = existing?.parameters && typeof existing.parameters === 'object'
                ? existing.parameters
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
        const isImage = generation?.type === client_1.GenerationType.TEXT_TO_IMAGE ||
            generation?.type === client_1.GenerationType.IMAGE_TO_IMAGE;
        let thumbnailUrls = result.outputUrls.map(() => null);
        if (isImage) {
            thumbnailUrls = await Promise.all(result.outputUrls.map((url, i) => this.uploadsService
                .generateThumbnail(url, `thumbnails/${generationId}`, `thumb_${i}.jpg`)
                .catch(() => null)));
        }
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
            await this.creditsService.partialRefund(generation.userId, creditsRefunded, generationId, `Estorno parcial: ${actualCount}/${requestedCount} vídeos gerados`);
            this.logger.log(`Partial refund of ${creditsRefunded} credits for generation ${generationId} — ${actualCount}/${requestedCount} outputs`);
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
        this.logger.log(`Generation ${generationId} completed in ${processingTimeMs}ms — ${result.outputUrls.length} output(s)`);
    }
    async onFailed(job, error) {
        this.logger.error(`Job ${job.id} [${job.name}] failed (attempt ${job.attemptsMade}/${job.opts.attempts ?? 1}): ${error.message}`);
        if (job.attemptsMade < (job.opts.attempts ?? 1)) {
            this.logger.warn(`Job ${job.id} will be retried`);
            return;
        }
        await this.handleFailure(job.data.generationId, job.data.userId, job.data.creditsConsumed, error);
    }
    async handleFailure(generationId, userId, creditsConsumed, error) {
        const current = await this.prisma.generation.findUnique({
            where: { id: generationId },
            select: { status: true },
        });
        if (current?.status === client_1.GenerationStatus.COMPLETED ||
            current?.status === client_1.GenerationStatus.FAILED) {
            this.logger.warn(`Generation ${generationId} already ${current.status}, skipping handleFailure`);
            return;
        }
        this.logger.error(`Generation ${generationId} failed: ${error.message}`, error.stack);
        await this.prisma.generation.update({
            where: { id: generationId },
            data: {
                status: client_1.GenerationStatus.FAILED,
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
        this.logger.log(`Refunded ${creditsConsumed} credits for failed generation ${generationId}`);
    }
    async loadInputImagesAsBase64(generationId) {
        const inputImages = await this.prisma.generationInputImage.findMany({
            where: { generationId },
            orderBy: { order: 'asc' },
        });
        return Promise.all(inputImages
            .filter((img) => img.url)
            .map(async (img) => ({
            base64: await this.downloadToBase64(img.url),
            mimeType: img.mimeType ?? 'image/png',
        })));
    }
    async downloadToBase64(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to download from S3: ${response.status}`);
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        return buffer.toString('base64');
    }
};
exports.GenerationProcessor = GenerationProcessor;
__decorate([
    (0, bullmq_1.OnWorkerEvent)('failed'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [bullmq_2.Job, Error]),
    __metadata("design:returntype", Promise)
], GenerationProcessor.prototype, "onFailed", null);
exports.GenerationProcessor = GenerationProcessor = GenerationProcessor_1 = __decorate([
    (0, bullmq_1.Processor)(generation_queue_constants_1.GENERATION_QUEUE, {
        concurrency: 5,
        lockDuration: 15 * 60 * 1000,
    }),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        credits_service_1.CreditsService,
        uploads_service_1.UploadsService,
        geraew_provider_1.GeraewProvider,
        nano_banana_provider_1.NanoBananaProvider,
        wan_provider_1.WanProvider,
        generation_events_service_1.GenerationEventsService])
], GenerationProcessor);
//# sourceMappingURL=generation.processor.js.map