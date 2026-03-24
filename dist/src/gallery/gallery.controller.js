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
Object.defineProperty(exports, "__esModule", { value: true });
exports.GalleryController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const gallery_service_1 = require("./gallery.service");
const decorators_1 = require("../common/decorators");
const gallery_filters_dto_1 = require("./dto/gallery-filters.dto");
const gallery_stats_response_dto_1 = require("./dto/gallery-stats-response.dto");
let GalleryController = class GalleryController {
    galleryService;
    constructor(galleryService) {
        this.galleryService = galleryService;
    }
    async getGallery(userId, filters) {
        return this.galleryService.getGallery(userId, filters);
    }
    async getStats(userId) {
        return this.galleryService.getStats(userId);
    }
};
exports.GalleryController = GalleryController;
__decorate([
    (0, common_1.Get)(),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true, whitelist: true })),
    (0, swagger_1.ApiOperation)({ summary: 'Lista gerações completadas (galeria)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Galeria retornada com sucesso' }),
    __param(0, (0, decorators_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, gallery_filters_dto_1.GalleryFiltersDto]),
    __metadata("design:returntype", Promise)
], GalleryController.prototype, "getGallery", null);
__decorate([
    (0, common_1.Get)('stats'),
    (0, swagger_1.ApiOperation)({ summary: 'Estatísticas da galeria do usuário' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Estatísticas retornadas com sucesso',
        type: gallery_stats_response_dto_1.GalleryStatsResponseDto,
    }),
    __param(0, (0, decorators_1.CurrentUser)('sub')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], GalleryController.prototype, "getStats", null);
exports.GalleryController = GalleryController = __decorate([
    (0, swagger_1.ApiTags)('gallery'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('api/v1/gallery'),
    __metadata("design:paramtypes", [gallery_service_1.GalleryService])
], GalleryController);
//# sourceMappingURL=gallery.controller.js.map