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
var GalleryCleanupService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GalleryCleanupService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const prisma_service_1 = require("../prisma/prisma.service");
const uploads_service_1 = require("../uploads/uploads.service");
let GalleryCleanupService = GalleryCleanupService_1 = class GalleryCleanupService {
    prisma;
    uploadsService;
    logger = new common_1.Logger(GalleryCleanupService_1.name);
    constructor(prisma, uploadsService) {
        this.prisma = prisma;
        this.uploadsService = uploadsService;
    }
    async handleGalleryCleanup() {
        try {
            const now = new Date();
            const expiredGenerations = await this.prisma.generation.findMany({
                where: {
                    expiresAt: { lte: now },
                    isDeleted: false,
                },
                select: {
                    id: true,
                    outputs: { select: { url: true, thumbnailUrl: true } },
                },
                take: 200,
            });
            if (expiredGenerations.length === 0)
                return;
            await this.prisma.generation.updateMany({
                where: {
                    id: { in: expiredGenerations.map((g) => g.id) },
                },
                data: { isDeleted: true },
            });
            this.logger.log(`Marked ${expiredGenerations.length} expired generations as deleted`);
            for (const gen of expiredGenerations) {
                this.deleteGenerationFiles(gen.id).catch((err) => {
                    this.logger.warn(`Failed to delete S3 files for generation ${gen.id}: ${err.message}`);
                });
            }
        }
        catch (error) {
            this.logger.error(`Gallery cleanup cron failed: ${error.message}`, error.stack);
        }
    }
    async deleteGenerationFiles(generationId) {
        const [outputsDeleted, thumbnailsDeleted] = await Promise.all([
            this.uploadsService.deleteByPrefix(`outputs/${generationId}/`),
            this.uploadsService.deleteByPrefix(`thumbnails/${generationId}/`),
        ]);
        if (outputsDeleted + thumbnailsDeleted > 0) {
            this.logger.log(`Deleted ${outputsDeleted + thumbnailsDeleted} S3 file(s) for expired generation ${generationId}`);
        }
    }
};
exports.GalleryCleanupService = GalleryCleanupService;
__decorate([
    (0, schedule_1.Cron)('0 3 * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], GalleryCleanupService.prototype, "handleGalleryCleanup", null);
exports.GalleryCleanupService = GalleryCleanupService = GalleryCleanupService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        uploads_service_1.UploadsService])
], GalleryCleanupService);
//# sourceMappingURL=gallery-cleanup.service.js.map