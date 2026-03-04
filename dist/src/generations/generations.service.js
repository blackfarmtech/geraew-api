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
const nano_banana_provider_1 = require("./providers/nano-banana.provider");
const kling_provider_1 = require("./providers/kling.provider");
const veo_provider_1 = require("./providers/veo.provider");
const uploads_service_1 = require("../uploads/uploads.service");
let GenerationsService = GenerationsService_1 = class GenerationsService {
    prisma;
    creditsService;
    plansService;
    uploadsService;
    nanoBananaProvider;
    klingProvider;
    veoProvider;
    logger = new common_1.Logger(GenerationsService_1.name);
    constructor(prisma, creditsService, plansService, uploadsService, nanoBananaProvider, klingProvider, veoProvider) {
        this.prisma = prisma;
        this.creditsService = creditsService;
        this.plansService = plansService;
        this.uploadsService = uploadsService;
        this.nanoBananaProvider = nanoBananaProvider;
        this.klingProvider = klingProvider;
        this.veoProvider = veoProvider;
    }
    async createGeneration(userId, type, dto) {
        const hasAudio = dto.hasAudio ?? false;
        const creditsRequired = await this.plansService.calculateGenerationCost(type, dto.resolution, dto.durationSeconds, hasAudio);
        const balance = await this.creditsService.getBalance(userId);
        if (balance.totalCreditsAvailable < creditsRequired) {
            throw new common_1.BadRequestException({
                code: 'INSUFFICIENT_CREDITS',
                message: `Créditos insuficientes. Necessário: ${creditsRequired}, disponível: ${balance.totalCreditsAvailable}.`,
                statusCode: 402,
            });
        }
        const generation = await this.prisma.$transaction(async (tx) => {
            const gen = await tx.generation.create({
                data: {
                    userId,
                    type,
                    status: client_1.GenerationStatus.PROCESSING,
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
                    },
                    creditsConsumed: creditsRequired,
                },
            });
            return gen;
        });
        await this.creditsService.debit(userId, creditsRequired, client_1.CreditTransactionType.GENERATION_DEBIT, generation.id, `Geração ${type} ${dto.resolution}`);
        this.processGeneration(generation).catch((error) => {
            this.handleFailure(generation.id, userId, creditsRequired, error);
        });
        return {
            id: generation.id,
            status: client_1.GenerationStatus.PROCESSING,
            creditsConsumed: creditsRequired,
        };
    }
    async checkConcurrentLimit(userId) {
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
                status: client_1.GenerationStatus.PROCESSING,
            },
        });
        if (activeCount >= maxConcurrent) {
            throw new common_1.BadRequestException({
                code: 'MAX_CONCURRENT_REACHED',
                message: `Limite de ${maxConcurrent} geração(ões) simultânea(s) atingido. Aguarde a conclusão das gerações em andamento.`,
                statusCode: 429,
            });
        }
    }
    getProvider(type) {
        switch (type) {
            case client_1.GenerationType.TEXT_TO_IMAGE:
            case client_1.GenerationType.IMAGE_TO_IMAGE:
                return this.nanoBananaProvider;
            case client_1.GenerationType.MOTION_CONTROL:
                return this.klingProvider;
            case client_1.GenerationType.TEXT_TO_VIDEO:
            case client_1.GenerationType.IMAGE_TO_VIDEO:
                return this.veoProvider;
            default:
                throw new common_1.BadRequestException(`Tipo de geração não suportado: ${type}`);
        }
    }
    async processGeneration(generation) {
        const startTime = Date.now();
        await this.prisma.generation.update({
            where: { id: generation.id },
            data: { processingStartedAt: new Date() },
        });
        const provider = this.getProvider(generation.type);
        const inputImageUrl = generation.inputImageUrl
            ? await this.resolveFileUrl(generation.inputImageUrl)
            : undefined;
        const referenceVideoUrl = generation.referenceVideoUrl
            ? await this.resolveFileUrl(generation.referenceVideoUrl)
            : undefined;
        const input = {
            id: generation.id,
            type: generation.type,
            prompt: generation.prompt ?? undefined,
            negativePrompt: generation.negativePrompt ?? undefined,
            inputImageUrl,
            referenceVideoUrl,
            resolution: generation.resolution,
            durationSeconds: generation.durationSeconds ?? undefined,
            hasAudio: generation.hasAudio,
            parameters: generation.parameters ?? undefined,
        };
        const result = await provider.generate(input);
        const processingTimeMs = Date.now() - startTime;
        await this.prisma.generation.update({
            where: { id: generation.id },
            data: {
                status: client_1.GenerationStatus.COMPLETED,
                outputUrl: result.outputUrl,
                thumbnailUrl: result.thumbnailUrl,
                modelUsed: result.modelUsed,
                processingTimeMs,
                completedAt: new Date(),
            },
        });
        this.logger.log(`Generation ${generation.id} completed in ${processingTimeMs}ms`);
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
            inputImageUrl: generation.inputImageUrl ?? undefined,
            referenceVideoUrl: generation.referenceVideoUrl ?? undefined,
            resolution: generation.resolution,
            durationSeconds: generation.durationSeconds ?? undefined,
            hasAudio: generation.hasAudio,
            modelUsed: generation.modelUsed ?? undefined,
            parameters: generation.parameters ?? undefined,
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
        nano_banana_provider_1.NanoBananaProvider,
        kling_provider_1.KlingProvider,
        veo_provider_1.VeoProvider])
], GenerationsService);
//# sourceMappingURL=generations.service.js.map