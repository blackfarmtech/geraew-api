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
Object.defineProperty(exports, "__esModule", { value: true });
exports.GalleryService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
const paginated_response_dto_1 = require("../common/dto/paginated-response.dto");
let GalleryService = class GalleryService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getGallery(userId, pagination) {
        const where = {
            userId,
            status: client_1.GenerationStatus.COMPLETED,
            isDeleted: false,
        };
        const [generations, total] = await Promise.all([
            this.prisma.generation.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: pagination.skip,
                take: pagination.limit,
                include: {
                    outputs: { orderBy: { order: 'asc' } },
                    inputImages: { orderBy: { order: 'asc' } },
                },
            }),
            this.prisma.generation.count({ where }),
        ]);
        const data = generations.map((gen) => ({
            id: gen.id,
            type: gen.type,
            status: gen.status,
            prompt: gen.prompt ?? undefined,
            negativePrompt: gen.negativePrompt ?? undefined,
            resolution: gen.resolution,
            durationSeconds: gen.durationSeconds ?? undefined,
            hasAudio: gen.hasAudio,
            modelUsed: gen.modelUsed ?? undefined,
            parameters: gen.parameters ?? undefined,
            outputs: gen.outputs.map((o) => ({
                id: o.id,
                url: o.url,
                mimeType: o.mimeType ?? undefined,
                order: o.order,
            })),
            inputImages: gen.inputImages.map((img) => ({
                id: img.id,
                role: img.role,
                mimeType: img.mimeType ?? undefined,
                order: img.order,
                referenceType: img.referenceType ?? undefined,
                url: img.url ?? undefined,
            })),
            hasWatermark: gen.hasWatermark,
            creditsConsumed: gen.creditsConsumed,
            processingTimeMs: gen.processingTimeMs ?? undefined,
            errorMessage: gen.errorMessage ?? undefined,
            errorCode: gen.errorCode ?? undefined,
            isFavorited: gen.isFavorited,
            createdAt: gen.createdAt,
            completedAt: gen.completedAt ?? undefined,
        }));
        return new paginated_response_dto_1.PaginatedResponseDto(data, total, pagination.page, pagination.limit);
    }
    async getStats(userId) {
        const baseWhere = {
            userId,
            status: client_1.GenerationStatus.COMPLETED,
            isDeleted: false,
        };
        const [totalGenerations, creditsAgg, favoriteCount, typeCounts] = await Promise.all([
            this.prisma.generation.count({ where: baseWhere }),
            this.prisma.generation.aggregate({
                where: baseWhere,
                _sum: { creditsConsumed: true },
            }),
            this.prisma.generation.count({
                where: { ...baseWhere, isFavorited: true },
            }),
            this.prisma.generation.groupBy({
                by: ['type'],
                where: baseWhere,
                _count: true,
            }),
        ]);
        const generationsByType = {
            TEXT_TO_IMAGE: 0,
            IMAGE_TO_IMAGE: 0,
            TEXT_TO_VIDEO: 0,
            IMAGE_TO_VIDEO: 0,
            MOTION_CONTROL: 0,
        };
        for (const entry of typeCounts) {
            generationsByType[entry.type] = entry._count;
        }
        return {
            totalGenerations,
            totalCreditsUsed: creditsAgg._sum.creditsConsumed ?? 0,
            generationsByType,
            favoriteCount,
        };
    }
};
exports.GalleryService = GalleryService;
exports.GalleryService = GalleryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], GalleryService);
//# sourceMappingURL=gallery.service.js.map