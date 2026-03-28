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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var GenerationsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenerationsService = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const prisma_service_1 = require("../prisma/prisma.service");
const credits_service_1 = require("../credits/credits.service");
const plans_service_1 = require("../plans/plans.service");
const client_1 = require("@prisma/client");
const paginated_response_dto_1 = require("../common/dto/paginated-response.dto");
const uploads_service_1 = require("../uploads/uploads.service");
const video_duration_util_1 = require("./utils/video-duration.util");
function getModelVariant(model) {
    if (!model)
        return null;
    const MODEL_TO_VARIANT = {
        'gemini-3-pro-image-preview': 'NBP',
        'gemini-3.1-flash-image-preview': 'NB2',
        'nano-banana-pro': 'NBP',
        'nano-banana-2': 'NB2',
        'veo-3.1-fast-generate-preview': 'VEO_FAST',
        'veo-3.1-generate-preview': 'VEO_MAX',
    };
    return MODEL_TO_VARIANT[model] ?? null;
}
const generation_queue_constants_1 = require("./queue/generation-queue.constants");
let GenerationsService = GenerationsService_1 = class GenerationsService {
    prisma;
    creditsService;
    plansService;
    uploadsService;
    generationQueue;
    logger = new common_1.Logger(GenerationsService_1.name);
    constructor(prisma, creditsService, plansService, uploadsService, generationQueue) {
        this.prisma = prisma;
        this.creditsService = creditsService;
        this.plansService = plansService;
        this.uploadsService = uploadsService;
        this.generationQueue = generationQueue;
    }
    async generateImage(userId, dto) {
        const type = dto.images?.length
            ? client_1.GenerationType.IMAGE_TO_IMAGE
            : client_1.GenerationType.TEXT_TO_IMAGE;
        const modelVariant = dto.model_variant ?? getModelVariant(dto.model);
        const creditsRequired = await this.plansService.calculateGenerationCost(type, dto.resolution, undefined, false, 1, modelVariant);
        await this.checkConcurrentLimit(userId);
        await this.ensureSufficientBalance(userId, creditsRequired);
        const generation = await this.prisma.generation.create({
            data: {
                userId,
                type,
                status: client_1.GenerationStatus.PROCESSING,
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
            const uploadedUrls = await Promise.all(dto.images.map((img) => this.uploadBase64Image(img.base64, img.mime_type ?? 'image/png', generation.id)));
            await this.prisma.generationInputImage.createMany({
                data: dto.images.map((img, i) => ({
                    generationId: generation.id,
                    role: client_1.GenerationImageRole.REFERENCE,
                    mimeType: img.mime_type ?? 'image/png',
                    order: i,
                    url: uploadedUrls[i],
                })),
            });
        }
        await this.debitCredits(userId, creditsRequired, generation.id, type, dto.resolution);
        await this.generationQueue.add(generation_queue_constants_1.GenerationJobName.IMAGE, {
            generationId: generation.id,
            userId,
            creditsConsumed: creditsRequired,
            prompt: dto.prompt,
            model: dto.model,
            resolution: dto.resolution,
            aspectRatio: dto.aspect_ratio,
            mimeType: dto.mime_type,
            hasInputImages: !!dto.images?.length,
        });
        return {
            id: generation.id,
            status: client_1.GenerationStatus.PROCESSING,
            creditsConsumed: creditsRequired,
        };
    }
    async generateImageWithFallback(userId, dto) {
        const type = dto.images?.length
            ? client_1.GenerationType.IMAGE_TO_IMAGE
            : client_1.GenerationType.TEXT_TO_IMAGE;
        const modelVariant = dto.model_variant ?? getModelVariant(dto.model);
        const creditsRequired = await this.plansService.calculateGenerationCost(type, dto.resolution, undefined, false, 1, modelVariant);
        await this.checkConcurrentLimit(userId);
        await this.ensureSufficientBalance(userId, creditsRequired);
        const generation = await this.prisma.generation.create({
            data: {
                userId,
                type,
                status: client_1.GenerationStatus.PROCESSING,
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
            const uploadedUrls = await Promise.all(dto.images.map((img) => this.uploadBase64Image(img.base64, img.mime_type ?? 'image/png', generation.id)));
            await this.prisma.generationInputImage.createMany({
                data: dto.images.map((img, i) => ({
                    generationId: generation.id,
                    role: client_1.GenerationImageRole.REFERENCE,
                    mimeType: img.mime_type ?? 'image/png',
                    order: i,
                    url: uploadedUrls[i],
                })),
            });
        }
        await this.debitCredits(userId, creditsRequired, generation.id, type, dto.resolution);
        await this.generationQueue.add(generation_queue_constants_1.GenerationJobName.IMAGE_WITH_FALLBACK, {
            generationId: generation.id,
            userId,
            creditsConsumed: creditsRequired,
            prompt: dto.prompt,
            model: dto.model,
            resolution: dto.resolution,
            aspectRatio: dto.aspect_ratio,
            mimeType: dto.mime_type,
            hasInputImages: !!dto.images?.length,
        });
        return {
            id: generation.id,
            status: client_1.GenerationStatus.PROCESSING,
            creditsConsumed: creditsRequired,
        };
    }
    async generateImageNanoBanana(userId, dto) {
        const type = dto.images?.length
            ? client_1.GenerationType.IMAGE_TO_IMAGE
            : client_1.GenerationType.TEXT_TO_IMAGE;
        const modelVariant = dto.model_variant ?? getModelVariant(dto.model ?? 'nano-banana-2');
        const creditsRequired = await this.plansService.calculateGenerationCost(type, dto.resolution, undefined, false, 1, modelVariant);
        await this.checkConcurrentLimit(userId);
        await this.ensureSufficientBalance(userId, creditsRequired);
        const generation = await this.prisma.generation.create({
            data: {
                userId,
                type,
                status: client_1.GenerationStatus.PROCESSING,
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
        let imageUrls;
        if (dto.images?.length) {
            const uploadedUrls = await Promise.all(dto.images.map((img) => this.uploadBase64Image(img.base64, img.mime_type ?? 'image/png', generation.id)));
            await this.prisma.generationInputImage.createMany({
                data: dto.images.map((img, i) => ({
                    generationId: generation.id,
                    role: client_1.GenerationImageRole.REFERENCE,
                    mimeType: img.mime_type ?? 'image/png',
                    order: i,
                    url: uploadedUrls[i],
                })),
            });
            imageUrls = uploadedUrls;
        }
        await this.debitCredits(userId, creditsRequired, generation.id, type, dto.resolution);
        await this.generationQueue.add(generation_queue_constants_1.GenerationJobName.IMAGE_NANO_BANANA, {
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
        });
        return {
            id: generation.id,
            status: client_1.GenerationStatus.PROCESSING,
            creditsConsumed: creditsRequired,
        };
    }
    async generateTextToVideo(userId, dto) {
        const type = client_1.GenerationType.TEXT_TO_VIDEO;
        const hasAudio = dto.generate_audio ?? true;
        const sampleCount = dto.sample_count ?? 1;
        const modelVariant = dto.model_variant ?? getModelVariant(dto.model);
        await this.blockVeoForFreePlan(userId, modelVariant);
        const creditsRequired = await this.plansService.calculateGenerationCost(type, dto.resolution, dto.duration_seconds, hasAudio, sampleCount, modelVariant);
        await this.checkConcurrentLimit(userId);
        await this.ensureSufficientBalance(userId, creditsRequired);
        const generation = await this.prisma.generation.create({
            data: {
                userId,
                type,
                status: client_1.GenerationStatus.PROCESSING,
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
        await this.generationQueue.add(generation_queue_constants_1.GenerationJobName.TEXT_TO_VIDEO, {
            generationId: generation.id,
            userId,
            creditsConsumed: creditsRequired,
            prompt: dto.prompt,
            model: dto.model,
            resolution: dto.resolution,
            durationSeconds: dto.duration_seconds,
            aspectRatio: dto.aspect_ratio,
            generateAudio: hasAudio,
            sampleCount,
            negativePrompt: dto.negative_prompt,
        });
        return {
            id: generation.id,
            status: client_1.GenerationStatus.PROCESSING,
            creditsConsumed: creditsRequired,
        };
    }
    async generateImageToVideo(userId, dto) {
        const type = client_1.GenerationType.IMAGE_TO_VIDEO;
        const model = dto.model ?? 'veo-3.1-generate-preview';
        const hasAudio = dto.generate_audio ?? true;
        const sampleCount = dto.sample_count ?? 1;
        const modelVariant = dto.model_variant ?? getModelVariant(model);
        await this.blockVeoForFreePlan(userId, modelVariant);
        const creditsRequired = await this.plansService.calculateGenerationCost(type, dto.resolution, dto.duration_seconds, hasAudio, sampleCount, modelVariant);
        await this.checkConcurrentLimit(userId);
        await this.ensureSufficientBalance(userId, creditsRequired);
        const generation = await this.prisma.generation.create({
            data: {
                userId,
                type,
                status: client_1.GenerationStatus.PROCESSING,
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
        const firstFrameUrl = await this.uploadBase64Image(dto.first_frame, dto.first_frame_mime_type ?? 'image/jpeg', generation.id);
        const inputImageData = [
            {
                generationId: generation.id,
                role: client_1.GenerationImageRole.FIRST_FRAME,
                mimeType: dto.first_frame_mime_type ?? 'image/jpeg',
                order: 0,
                url: firstFrameUrl,
            },
        ];
        if (dto.last_frame) {
            const lastFrameUrl = await this.uploadBase64Image(dto.last_frame, dto.last_frame_mime_type ?? 'image/jpeg', generation.id);
            inputImageData.push({
                generationId: generation.id,
                role: client_1.GenerationImageRole.LAST_FRAME,
                mimeType: dto.last_frame_mime_type ?? 'image/jpeg',
                order: 1,
                url: lastFrameUrl,
            });
        }
        await this.prisma.generationInputImage.createMany({ data: inputImageData });
        await this.debitCredits(userId, creditsRequired, generation.id, type, dto.resolution);
        await this.generationQueue.add(generation_queue_constants_1.GenerationJobName.IMAGE_TO_VIDEO, {
            generationId: generation.id,
            userId,
            creditsConsumed: creditsRequired,
            prompt: dto.prompt,
            model: dto.model ?? model,
            resolution: dto.resolution,
            durationSeconds: dto.duration_seconds,
            aspectRatio: dto.aspect_ratio,
            generateAudio: hasAudio,
            sampleCount,
            negativePrompt: dto.negative_prompt,
            resolvedModel: model,
        });
        return {
            id: generation.id,
            status: client_1.GenerationStatus.PROCESSING,
            creditsConsumed: creditsRequired,
        };
    }
    async generateVideoWithReferences(userId, dto) {
        const type = client_1.GenerationType.REFERENCE_VIDEO;
        const model = dto.model ?? 'veo-3.1-generate-preview';
        const hasAudio = dto.generate_audio ?? true;
        const sampleCount = dto.sample_count ?? 1;
        const modelVariant = dto.model_variant ?? getModelVariant(model);
        await this.blockVeoForFreePlan(userId, modelVariant);
        const creditsRequired = await this.plansService.calculateGenerationCost(type, dto.resolution, dto.duration_seconds, hasAudio, sampleCount, modelVariant);
        await this.checkConcurrentLimit(userId);
        await this.ensureSufficientBalance(userId, creditsRequired);
        const generation = await this.prisma.generation.create({
            data: {
                userId,
                type,
                status: client_1.GenerationStatus.PROCESSING,
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
            const uploadedUrls = await Promise.all(dto.reference_images.map((ref) => this.uploadBase64Image(ref.base64, ref.mime_type ?? 'image/jpeg', generation.id)));
            await this.prisma.generationInputImage.createMany({
                data: dto.reference_images.map((ref, i) => ({
                    generationId: generation.id,
                    role: client_1.GenerationImageRole.REFERENCE,
                    mimeType: ref.mime_type ?? 'image/jpeg',
                    order: i,
                    referenceType: ref.reference_type,
                    url: uploadedUrls[i],
                })),
            });
        }
        await this.debitCredits(userId, creditsRequired, generation.id, type, dto.resolution);
        await this.generationQueue.add(generation_queue_constants_1.GenerationJobName.REFERENCE_VIDEO, {
            generationId: generation.id,
            userId,
            creditsConsumed: creditsRequired,
            prompt: dto.prompt,
            model: dto.model ?? model,
            resolution: dto.resolution,
            durationSeconds: dto.duration_seconds,
            aspectRatio: dto.aspect_ratio,
            generateAudio: hasAudio,
            sampleCount,
            negativePrompt: dto.negative_prompt,
            resolvedModel: model,
        });
        return {
            id: generation.id,
            status: client_1.GenerationStatus.PROCESSING,
            creditsConsumed: creditsRequired,
        };
    }
    async generateMotionControl(userId, dto) {
        const type = client_1.GenerationType.MOTION_CONTROL;
        const resolution = dto.resolution ?? '720p';
        const dbResolution = resolution === '1080p' ? client_1.Resolution.RES_1080P : client_1.Resolution.RES_720P;
        const videoBuffer = Buffer.from(dto.video, 'base64');
        const durationSeconds = (0, video_duration_util_1.getVideoDurationSeconds)(videoBuffer);
        const creditsRequired = await this.plansService.calculateGenerationCost(type, dbResolution, durationSeconds, false);
        await this.checkConcurrentLimit(userId);
        await this.ensureSufficientBalance(userId, creditsRequired);
        const generation = await this.prisma.generation.create({
            data: {
                userId,
                type,
                status: client_1.GenerationStatus.PROCESSING,
                modelUsed: 'kling-2.6/motion-control',
                resolution: dbResolution,
                durationSeconds,
                hasAudio: false,
                creditsConsumed: creditsRequired,
                parameters: { resolution },
            },
        });
        const videoMime = dto.video_mime_type ?? 'video/mp4';
        const videoExt = videoMime === 'video/quicktime' ? 'mov' : videoMime === 'video/x-matroska' ? 'mkv' : 'mp4';
        const { publicUrl: videoPublicUrl, signedUrl: videoSignedUrl } = await this.uploadsService.uploadBufferPublic(videoBuffer, `inputs/${generation.id}`, `input_video.${videoExt}`, videoMime);
        const imageMime = dto.image_mime_type ?? 'image/jpeg';
        const imageExt = imageMime === 'image/png' ? 'png' : imageMime === 'image/webp' ? 'webp' : 'jpg';
        const imageBuffer = Buffer.from(dto.image, 'base64');
        const { publicUrl: imagePublicUrl, signedUrl: imageSignedUrl } = await this.uploadsService.uploadBufferPublic(imageBuffer, `inputs/${generation.id}`, `input_image.${imageExt}`, imageMime);
        await this.prisma.generationInputImage.createMany({
            data: [
                {
                    generationId: generation.id,
                    role: client_1.GenerationImageRole.REFERENCE,
                    mimeType: videoMime,
                    order: 0,
                    url: videoSignedUrl,
                },
                {
                    generationId: generation.id,
                    role: client_1.GenerationImageRole.REFERENCE,
                    mimeType: imageMime,
                    order: 1,
                    url: imageSignedUrl,
                },
            ],
        });
        await this.debitCredits(userId, creditsRequired, generation.id, type, dbResolution);
        await this.generationQueue.add(generation_queue_constants_1.GenerationJobName.MOTION_CONTROL, {
            generationId: generation.id,
            userId,
            creditsConsumed: creditsRequired,
            videoUrl: videoPublicUrl,
            imageUrl: imagePublicUrl,
            resolution,
        });
        return {
            id: generation.id,
            status: client_1.GenerationStatus.PROCESSING,
            creditsConsumed: creditsRequired,
        };
    }
    async blockVeoForFreePlan(userId, modelVariant) {
        if (modelVariant !== 'VEO_FAST' && modelVariant !== 'VEO_MAX') {
            return;
        }
        const subscription = await this.prisma.subscription.findFirst({
            where: { userId, status: 'ACTIVE' },
            include: { plan: true },
        });
        if (!subscription || subscription.plan.slug === 'free') {
            throw new common_1.ForbiddenException({
                code: 'PLAN_UPGRADE_REQUIRED',
                message: 'Veo está disponível apenas para planos pagos. Faça upgrade para Starter ou superior.',
                statusCode: 403,
            });
        }
    }
    async checkConcurrentLimit(userId) {
        const [processingCount, subscription] = await Promise.all([
            this.prisma.generation.count({
                where: { userId, status: client_1.GenerationStatus.PROCESSING },
            }),
            this.prisma.subscription.findFirst({
                where: { userId, status: 'ACTIVE' },
                select: { plan: { select: { maxConcurrentGenerations: true } } },
                orderBy: { createdAt: 'desc' },
            }),
        ]);
        const maxConcurrent = subscription?.plan.maxConcurrentGenerations ?? 5;
        if (processingCount >= maxConcurrent) {
            throw new common_1.HttpException({
                code: 'MAX_CONCURRENT_REACHED',
                message: `Limite de ${maxConcurrent} geração(ões) simultânea(s) atingido. Aguarde uma geração concluir antes de iniciar outra.`,
            }, common_1.HttpStatus.TOO_MANY_REQUESTS);
        }
    }
    async ensureSufficientBalance(userId, creditsRequired) {
        const balance = await this.creditsService.getBalance(userId);
        if (balance.totalCreditsAvailable < creditsRequired) {
            throw new common_1.BadRequestException({
                code: 'INSUFFICIENT_CREDITS',
                message: `Créditos insuficientes. Necessário: ${creditsRequired}, disponível: ${balance.totalCreditsAvailable}.`,
                statusCode: 402,
            });
        }
    }
    async debitCredits(userId, creditsRequired, generationId, type, resolution) {
        await this.creditsService.debit(userId, creditsRequired, client_1.CreditTransactionType.GENERATION_DEBIT, generationId, `Geração ${type} ${resolution}`);
    }
    async findById(userId, generationId) {
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
            throw new common_1.NotFoundException('Geração não encontrada');
        }
        return this.toResponseDto(generation);
    }
    async findFolders(userId, generationId) {
        const generation = await this.prisma.generation.findFirst({
            where: { id: generationId, userId, isDeleted: false },
            select: { id: true },
        });
        if (!generation) {
            throw new common_1.NotFoundException('Geração não encontrada');
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
    async findAll(userId, filters) {
        const where = {
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
        let orderBy = { createdAt: 'desc' };
        if (filters.sort) {
            const [field, direction] = filters.sort.split(':');
            const fieldMap = {
                created_at: 'createdAt',
                completed_at: 'completedAt',
                credits_consumed: 'creditsConsumed',
            };
            const mappedField = fieldMap[field];
            if (mappedField) {
                orderBy = { [mappedField]: direction === 'asc' ? 'asc' : 'desc' };
            }
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
        return new paginated_response_dto_1.PaginatedResponseDto(data, total, filters.page, filters.limit);
    }
    async softDelete(userId, generationId) {
        const generation = await this.prisma.generation.findFirst({
            where: { id: generationId, userId },
        });
        if (!generation) {
            throw new common_1.NotFoundException('Geração não encontrada');
        }
        await this.prisma.generation.update({
            where: { id: generationId },
            data: { isDeleted: true },
        });
    }
    async deleteOutput(userId, generationId, outputId) {
        const generation = await this.prisma.generation.findFirst({
            where: { id: generationId, userId },
            include: { outputs: { select: { id: true } } },
        });
        if (!generation) {
            throw new common_1.NotFoundException('Geração não encontrada');
        }
        const output = generation.outputs.find((o) => o.id === outputId);
        if (!output) {
            throw new common_1.NotFoundException('Output não encontrado nesta geração');
        }
        await this.prisma.generationOutput.delete({
            where: { id: outputId },
        });
    }
    async toggleFavorite(userId, generationId, isFavorited) {
        const generation = await this.prisma.generation.findFirst({
            where: { id: generationId, userId, isDeleted: false },
        });
        if (!generation) {
            throw new common_1.NotFoundException('Geração não encontrada');
        }
        await this.prisma.generation.update({
            where: { id: generationId },
            data: { isFavorited },
        });
    }
    toResponseDto(generation) {
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
            parameters: generation.parameters ?? undefined,
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
    async uploadBase64Image(base64, mimeType, generationId) {
        const buffer = Buffer.from(base64, 'base64');
        const ext = mimeType.split('/')[1] ?? 'jpg';
        return this.uploadsService.uploadBuffer(buffer, `inputs/${generationId}`, `input.${ext}`, mimeType);
    }
};
exports.GenerationsService = GenerationsService;
exports.GenerationsService = GenerationsService = GenerationsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(4, (0, bullmq_1.InjectQueue)(generation_queue_constants_1.GENERATION_QUEUE)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        credits_service_1.CreditsService,
        plans_service_1.PlansService,
        uploads_service_1.UploadsService,
        bullmq_2.Queue])
], GenerationsService);
//# sourceMappingURL=generations.service.js.map