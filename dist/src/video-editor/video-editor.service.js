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
var VideoEditorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoEditorService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const uploads_service_1 = require("../uploads/uploads.service");
const ffmpeg_service_1 = require("./ffmpeg.service");
const paginated_response_dto_1 = require("../common/dto/paginated-response.dto");
const client_1 = require("@prisma/client");
const fs = require("fs");
const path = require("path");
const crypto_1 = require("crypto");
let VideoEditorService = VideoEditorService_1 = class VideoEditorService {
    prisma;
    uploadsService;
    ffmpegService;
    logger = new common_1.Logger(VideoEditorService_1.name);
    constructor(prisma, uploadsService, ffmpegService) {
        this.prisma = prisma;
        this.uploadsService = uploadsService;
        this.ffmpegService = ffmpegService;
    }
    async createProject(userId, dto) {
        const project = await this.prisma.videoProject.create({
            data: {
                userId,
                ...(dto.name && { name: dto.name }),
            },
            include: { clips: { orderBy: { order: 'asc' } } },
        });
        return this.toProjectResponse(project);
    }
    async listProjects(userId, pagination) {
        const where = { userId };
        const [projects, total] = await Promise.all([
            this.prisma.videoProject.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: pagination.skip,
                take: pagination.limit,
                include: { clips: { orderBy: { order: 'asc' } } },
            }),
            this.prisma.videoProject.count({ where }),
        ]);
        const data = projects.map((p) => this.toProjectResponse(p));
        return new paginated_response_dto_1.PaginatedResponseDto(data, total, pagination.page, pagination.limit);
    }
    async getProject(userId, projectId) {
        const project = await this.prisma.videoProject.findUnique({
            where: { id: projectId },
            include: { clips: { orderBy: { order: 'asc' } } },
        });
        if (!project)
            throw new common_1.NotFoundException('Projeto nao encontrado');
        if (project.userId !== userId)
            throw new common_1.ForbiddenException('Acesso negado');
        return this.toProjectResponse(project);
    }
    async updateProject(userId, projectId, dto) {
        const project = await this.prisma.videoProject.findUnique({
            where: { id: projectId },
        });
        if (!project)
            throw new common_1.NotFoundException('Projeto nao encontrado');
        if (project.userId !== userId)
            throw new common_1.ForbiddenException('Acesso negado');
        const updated = await this.prisma.videoProject.update({
            where: { id: projectId },
            data: {
                ...(dto.name !== undefined && { name: dto.name }),
            },
            include: { clips: { orderBy: { order: 'asc' } } },
        });
        return this.toProjectResponse(updated);
    }
    async deleteProject(userId, projectId) {
        const project = await this.prisma.videoProject.findUnique({
            where: { id: projectId },
        });
        if (!project)
            throw new common_1.NotFoundException('Projeto nao encontrado');
        if (project.userId !== userId)
            throw new common_1.ForbiddenException('Acesso negado');
        await this.prisma.videoProject.delete({ where: { id: projectId } });
    }
    async addClip(userId, projectId, dto) {
        const project = await this.prisma.videoProject.findUnique({
            where: { id: projectId },
        });
        if (!project)
            throw new common_1.NotFoundException('Projeto nao encontrado');
        if (project.userId !== userId)
            throw new common_1.ForbiddenException('Acesso negado');
        let order = dto.order;
        if (order == null) {
            const lastClip = await this.prisma.videoProjectClip.findFirst({
                where: { projectId },
                orderBy: { order: 'desc' },
                select: { order: true },
            });
            order = (lastClip?.order ?? -1) + 1;
        }
        const clip = await this.prisma.videoProjectClip.create({
            data: {
                projectId,
                sourceUrl: dto.sourceUrl,
                thumbnailUrl: dto.thumbnailUrl,
                order,
                startMs: dto.startMs ?? 0,
                endMs: dto.endMs,
                durationMs: dto.durationMs,
            },
        });
        return this.toClipResponse(clip);
    }
    async updateClip(userId, projectId, clipId, dto) {
        const project = await this.prisma.videoProject.findUnique({
            where: { id: projectId },
        });
        if (!project)
            throw new common_1.NotFoundException('Projeto nao encontrado');
        if (project.userId !== userId)
            throw new common_1.ForbiddenException('Acesso negado');
        const clip = await this.prisma.videoProjectClip.findFirst({
            where: { id: clipId, projectId },
        });
        if (!clip)
            throw new common_1.NotFoundException('Clip nao encontrado');
        const updated = await this.prisma.videoProjectClip.update({
            where: { id: clipId },
            data: {
                ...(dto.startMs !== undefined && { startMs: dto.startMs }),
                ...(dto.endMs !== undefined && { endMs: dto.endMs }),
            },
        });
        return this.toClipResponse(updated);
    }
    async deleteClip(userId, projectId, clipId) {
        const project = await this.prisma.videoProject.findUnique({
            where: { id: projectId },
        });
        if (!project)
            throw new common_1.NotFoundException('Projeto nao encontrado');
        if (project.userId !== userId)
            throw new common_1.ForbiddenException('Acesso negado');
        const clip = await this.prisma.videoProjectClip.findFirst({
            where: { id: clipId, projectId },
        });
        if (!clip)
            throw new common_1.NotFoundException('Clip nao encontrado');
        await this.prisma.videoProjectClip.delete({ where: { id: clipId } });
    }
    async reorderClips(userId, projectId, clipIds) {
        const project = await this.prisma.videoProject.findUnique({
            where: { id: projectId },
        });
        if (!project)
            throw new common_1.NotFoundException('Projeto nao encontrado');
        if (project.userId !== userId)
            throw new common_1.ForbiddenException('Acesso negado');
        await this.prisma.$transaction(clipIds.map((clipId, index) => this.prisma.videoProjectClip.update({
            where: { id: clipId },
            data: { order: index },
        })));
        const updated = await this.prisma.videoProject.findUnique({
            where: { id: projectId },
            include: { clips: { orderBy: { order: 'asc' } } },
        });
        return this.toProjectResponse(updated);
    }
    async render(userId, projectId) {
        const project = await this.prisma.videoProject.findUnique({
            where: { id: projectId },
            include: { clips: { orderBy: { order: 'asc' } } },
        });
        if (!project)
            throw new common_1.NotFoundException('Projeto nao encontrado');
        if (project.userId !== userId)
            throw new common_1.ForbiddenException('Acesso negado');
        if (project.clips.length === 0) {
            throw new common_1.BadRequestException('Projeto nao possui clips');
        }
        if (project.status === client_1.VideoProjectStatus.PROCESSING) {
            throw new common_1.BadRequestException('Projeto ja esta sendo processado');
        }
        const updated = await this.prisma.videoProject.update({
            where: { id: projectId },
            data: { status: client_1.VideoProjectStatus.PROCESSING, errorMessage: null },
            include: { clips: { orderBy: { order: 'asc' } } },
        });
        this.processRender(projectId, updated.clips).catch((err) => {
            this.logger.error(`Render failed for project ${projectId}: ${err.message}`);
        });
        return this.toProjectResponse(updated);
    }
    async processRender(projectId, clips) {
        const tempDir = path.join('/tmp', `render-${(0, crypto_1.randomUUID)()}`);
        fs.mkdirSync(tempDir, { recursive: true });
        const downloadedFiles = [];
        try {
            for (let i = 0; i < clips.length; i++) {
                const clip = clips[i];
                const ext = '.mp4';
                const filePath = path.join(tempDir, `clip-${i}${ext}`);
                this.logger.log(`Downloading clip ${i}: ${clip.sourceUrl}`);
                const response = await fetch(clip.sourceUrl);
                if (!response.ok) {
                    throw new Error(`Failed to download clip ${i}: ${response.status}`);
                }
                const buffer = Buffer.from(await response.arrayBuffer());
                fs.writeFileSync(filePath, buffer);
                downloadedFiles.push(filePath);
            }
            const clipInputs = clips.map((clip, i) => ({
                filePath: downloadedFiles[i],
                startMs: clip.startMs,
                endMs: clip.endMs ?? undefined,
            }));
            const outputPath = path.join(tempDir, 'output.mp4');
            await this.ffmpegService.trimAndConcat(clipInputs, outputPath);
            const durationMs = await this.ffmpegService.getVideoDuration(outputPath);
            const outputBuffer = fs.readFileSync(outputPath);
            const outputUrl = await this.uploadsService.uploadBuffer(outputBuffer, 'video-editor', `render-${projectId}.mp4`, 'video/mp4');
            await this.prisma.videoProject.update({
                where: { id: projectId },
                data: {
                    status: client_1.VideoProjectStatus.COMPLETED,
                    outputUrl,
                    durationMs,
                },
            });
            this.logger.log(`Render completed for project ${projectId}`);
        }
        catch (error) {
            this.logger.error(`Render error for project ${projectId}: ${error.message}`);
            await this.prisma.videoProject.update({
                where: { id: projectId },
                data: {
                    status: client_1.VideoProjectStatus.FAILED,
                    errorMessage: error.message,
                },
            });
        }
        finally {
            try {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
            catch (e) {
                this.logger.warn(`Failed to clean up temp dir ${tempDir}: ${e.message}`);
            }
        }
    }
    toProjectResponse(project) {
        return {
            id: project.id,
            name: project.name,
            status: project.status,
            outputUrl: project.outputUrl ?? undefined,
            outputThumbnailUrl: project.outputThumbnailUrl ?? undefined,
            durationMs: project.durationMs ?? undefined,
            errorMessage: project.errorMessage ?? undefined,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
            clips: project.clips?.map((c) => this.toClipResponse(c)),
        };
    }
    toClipResponse(clip) {
        return {
            id: clip.id,
            sourceUrl: clip.sourceUrl,
            thumbnailUrl: clip.thumbnailUrl ?? undefined,
            order: clip.order,
            startMs: clip.startMs,
            endMs: clip.endMs ?? undefined,
            durationMs: clip.durationMs,
            createdAt: clip.createdAt,
        };
    }
};
exports.VideoEditorService = VideoEditorService;
exports.VideoEditorService = VideoEditorService = VideoEditorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        uploads_service_1.UploadsService,
        ffmpeg_service_1.FfmpegService])
], VideoEditorService);
//# sourceMappingURL=video-editor.service.js.map