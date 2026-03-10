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
var GenerationsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenerationsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const credits_service_1 = require("../credits/credits.service");
const plans_service_1 = require("../plans/plans.service");
const client_1 = require("@prisma/client");
const paginated_response_dto_1 = require("../common/dto/paginated-response.dto");
const uploads_service_1 = require("../uploads/uploads.service");
const geraew_provider_1 = require("./providers/geraew.provider");
let GenerationsService = GenerationsService_1 = class GenerationsService {
    prisma;
    creditsService;
    plansService;
    uploadsService;
    geraewProvider;
    logger = new common_1.Logger(GenerationsService_1.name);
    constructor(prisma, creditsService, plansService, uploadsService, geraewProvider) {
        this.prisma = prisma;
        this.creditsService = creditsService;
        this.plansService = plansService;
        this.uploadsService = uploadsService;
        this.geraewProvider = geraewProvider;
    }
    async generateImage(userId, dto) {
        const type = dto.images?.length
            ? client_1.GenerationType.IMAGE_TO_IMAGE
            : client_1.GenerationType.TEXT_TO_IMAGE;
        const creditsRequired = await this.plansService.calculateGenerationCost(type, dto.resolution);
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
        this.processImageGeneration(generation.id, dto).catch((error) => {
            this.handleFailure(generation.id, userId, creditsRequired, error);
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
        const creditsRequired = await this.plansService.calculateGenerationCost(type, dto.resolution, dto.duration_seconds, hasAudio);
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
                quantity: dto.sample_count,
                creditsConsumed: creditsRequired,
            },
        });
        await this.debitCredits(userId, creditsRequired, generation.id, type, dto.resolution);
        this.processTextToVideoGeneration(generation.id, dto).catch((error) => {
            this.handleFailure(generation.id, userId, creditsRequired, error);
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
        const creditsRequired = await this.plansService.calculateGenerationCost(type, dto.resolution, dto.duration_seconds, hasAudio);
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
                quantity: dto.sample_count,
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
        this.processImageToVideoGeneration(generation.id, dto, model).catch((error) => {
            this.handleFailure(generation.id, userId, creditsRequired, error);
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
        const creditsRequired = await this.plansService.calculateGenerationCost(type, dto.resolution, dto.duration_seconds, hasAudio);
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
                quantity: dto.sample_count,
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
        this.processReferenceVideoGeneration(generation.id, dto, model).catch((error) => {
            this.handleFailure(generation.id, userId, creditsRequired, error);
        });
        return {
            id: generation.id,
            status: client_1.GenerationStatus.PROCESSING,
            creditsConsumed: creditsRequired,
        };
    }
    async processImageGeneration(generationId, dto) {
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
    async processTextToVideoGeneration(generationId, dto) {
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
    async processImageToVideoGeneration(generationId, dto, model) {
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
    async processReferenceVideoGeneration(generationId, dto, model) {
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
    async completeGeneration(generationId, result, startTime) {
        const processingTimeMs = Date.now() - startTime;
        await this.prisma.$transaction([
            this.prisma.generation.update({
                where: { id: generationId },
                data: {
                    status: client_1.GenerationStatus.COMPLETED,
                    modelUsed: result.modelUsed,
                    processingTimeMs,
                    completedAt: new Date(),
                },
            }),
            this.prisma.generationOutput.createMany({
                data: result.outputUrls.map((url, i) => ({
                    generationId,
                    url,
                    order: i,
                })),
            }),
        ]);
        this.logger.log(`Generation ${generationId} completed in ${processingTimeMs}ms — ${result.outputUrls.length} output(s)`);
    }
    async handleFailure(generationId, userId, creditsConsumed, error) {
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
        this.logger.log(`Refunded ${creditsConsumed} credits for failed generation ${generationId}`);
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
                inputImages: { orderBy: { order: 'asc' } },
            },
        });
        if (!generation) {
            throw new common_1.NotFoundException('Geração não encontrada');
        }
        return this.toResponseDto(generation);
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
    async uploadBase64Image(base64, mimeType, generationId) {
        const buffer = Buffer.from(base64, 'base64');
        const ext = mimeType.split('/')[1] ?? 'jpg';
        return this.uploadsService.uploadBuffer(buffer, `inputs/${generationId}`, `input.${ext}`, mimeType);
    }
    async resolveFileUrl(value) {
        if (value.startsWith('http://') || value.startsWith('https://')) {
            return value;
        }
        return this.uploadsService.getSignedReadUrl(value);
    }
};
exports.GenerationsService = GenerationsService;
exports.GenerationsService = GenerationsService = GenerationsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        credits_service_1.CreditsService,
        plans_service_1.PlansService,
        uploads_service_1.UploadsService,
        geraew_provider_1.GeraewProvider])
], GenerationsService);
//# sourceMappingURL=generations.service.js.map