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
let GalleryCleanupService = GalleryCleanupService_1 = class GalleryCleanupService {
    prisma;
    logger = new common_1.Logger(GalleryCleanupService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async handleGalleryCleanup() {
        try {
            const now = new Date();
            const result = await this.prisma.generation.updateMany({
                where: {
                    expiresAt: { lte: now },
                    isDeleted: false,
                },
                data: {
                    isDeleted: true,
                },
            });
            if (result.count > 0) {
                this.logger.log(`Marked ${result.count} expired generations as deleted`);
            }
        }
        catch (error) {
            this.logger.error(`Gallery cleanup cron failed: ${error.message}`, error.stack);
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
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], GalleryCleanupService);
//# sourceMappingURL=gallery-cleanup.service.js.map