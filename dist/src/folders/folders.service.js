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
exports.FoldersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
const paginated_response_dto_1 = require("../common/dto/paginated-response.dto");
let FoldersService = class FoldersService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(userId, dto) {
        const folder = await this.prisma.folder.create({
            data: {
                userId,
                name: dto.name,
                description: dto.description,
            },
            include: {
                _count: { select: { generationFolders: true } },
            },
        });
        return {
            id: folder.id,
            name: folder.name,
            description: folder.description ?? undefined,
            generationCount: folder._count.generationFolders,
            createdAt: folder.createdAt,
            updatedAt: folder.updatedAt,
        };
    }
    async findAll(userId, pagination) {
        const where = { userId };
        const [folders, total] = await Promise.all([
            this.prisma.folder.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: pagination.skip,
                take: pagination.limit,
                include: {
                    _count: { select: { generationFolders: true } },
                },
            }),
            this.prisma.folder.count({ where }),
        ]);
        const data = folders.map((folder) => ({
            id: folder.id,
            name: folder.name,
            description: folder.description ?? undefined,
            generationCount: folder._count.generationFolders,
            createdAt: folder.createdAt,
            updatedAt: folder.updatedAt,
        }));
        return new paginated_response_dto_1.PaginatedResponseDto(data, total, pagination.page, pagination.limit);
    }
    async findOne(userId, folderId, pagination) {
        const folder = await this.prisma.folder.findUnique({
            where: { id: folderId },
            include: {
                _count: { select: { generationFolders: true } },
            },
        });
        if (!folder) {
            throw new common_1.NotFoundException('Pasta nao encontrada');
        }
        if (folder.userId !== userId) {
            throw new common_1.ForbiddenException('Acesso negado');
        }
        const generationWhere = {
            generationFolders: { some: { folderId } },
            status: client_1.GenerationStatus.COMPLETED,
            isDeleted: false,
        };
        const [generations, total] = await Promise.all([
            this.prisma.generation.findMany({
                where: generationWhere,
                orderBy: { createdAt: 'desc' },
                skip: pagination.skip,
                take: pagination.limit,
                include: {
                    outputs: { orderBy: { order: 'asc' } },
                },
            }),
            this.prisma.generation.count({ where: generationWhere }),
        ]);
        const generationData = generations.map((gen) => ({
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
                thumbnailUrl: o.thumbnailUrl ?? undefined,
                mimeType: o.mimeType ?? undefined,
                order: o.order,
            })),
            inputImages: [],
            hasWatermark: gen.hasWatermark,
            creditsConsumed: gen.creditsConsumed,
            processingTimeMs: gen.processingTimeMs ?? undefined,
            errorMessage: gen.errorMessage ?? undefined,
            errorCode: gen.errorCode ?? undefined,
            isFavorited: gen.isFavorited,
            createdAt: gen.createdAt,
            completedAt: gen.completedAt ?? undefined,
        }));
        return {
            folder: {
                id: folder.id,
                name: folder.name,
                description: folder.description ?? undefined,
                generationCount: folder._count.generationFolders,
                createdAt: folder.createdAt,
                updatedAt: folder.updatedAt,
            },
            generations: new paginated_response_dto_1.PaginatedResponseDto(generationData, total, pagination.page, pagination.limit),
        };
    }
    async update(userId, folderId, dto) {
        const folder = await this.prisma.folder.findUnique({
            where: { id: folderId },
        });
        if (!folder) {
            throw new common_1.NotFoundException('Pasta nao encontrada');
        }
        if (folder.userId !== userId) {
            throw new common_1.ForbiddenException('Acesso negado');
        }
        const updated = await this.prisma.folder.update({
            where: { id: folderId },
            data: {
                ...(dto.name !== undefined && { name: dto.name }),
                ...(dto.description !== undefined && { description: dto.description }),
            },
            include: {
                _count: { select: { generationFolders: true } },
            },
        });
        return {
            id: updated.id,
            name: updated.name,
            description: updated.description ?? undefined,
            generationCount: updated._count.generationFolders,
            createdAt: updated.createdAt,
            updatedAt: updated.updatedAt,
        };
    }
    async remove(userId, folderId) {
        const folder = await this.prisma.folder.findUnique({
            where: { id: folderId },
        });
        if (!folder) {
            throw new common_1.NotFoundException('Pasta nao encontrada');
        }
        if (folder.userId !== userId) {
            throw new common_1.ForbiddenException('Acesso negado');
        }
        await this.prisma.folder.delete({ where: { id: folderId } });
    }
    async addGenerations(userId, folderId, generationIds) {
        const folder = await this.prisma.folder.findUnique({
            where: { id: folderId },
        });
        if (!folder) {
            throw new common_1.NotFoundException('Pasta nao encontrada');
        }
        if (folder.userId !== userId) {
            throw new common_1.ForbiddenException('Acesso negado');
        }
        const generations = await this.prisma.generation.findMany({
            where: {
                id: { in: generationIds },
                userId,
                isDeleted: false,
            },
            select: { id: true },
        });
        const validIds = generations.map((g) => g.id);
        const result = await this.prisma.generationFolder.createMany({
            data: validIds.map((generationId) => ({
                generationId,
                folderId,
            })),
            skipDuplicates: true,
        });
        return { added: result.count };
    }
    async removeGenerations(userId, folderId, generationIds) {
        const folder = await this.prisma.folder.findUnique({
            where: { id: folderId },
        });
        if (!folder) {
            throw new common_1.NotFoundException('Pasta nao encontrada');
        }
        if (folder.userId !== userId) {
            throw new common_1.ForbiddenException('Acesso negado');
        }
        const result = await this.prisma.generationFolder.deleteMany({
            where: {
                folderId,
                generationId: { in: generationIds },
            },
        });
        return { removed: result.count };
    }
};
exports.FoldersService = FoldersService;
exports.FoldersService = FoldersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], FoldersService);
//# sourceMappingURL=folders.service.js.map