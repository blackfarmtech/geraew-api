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
exports.GenerationsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const client_1 = require("@prisma/client");
const generations_service_1 = require("./generations.service");
const decorators_1 = require("../common/decorators");
const text_to_image_dto_1 = require("./dto/text-to-image.dto");
const image_to_image_dto_1 = require("./dto/image-to-image.dto");
const text_to_video_dto_1 = require("./dto/text-to-video.dto");
const image_to_video_dto_1 = require("./dto/image-to-video.dto");
const motion_control_dto_1 = require("./dto/motion-control.dto");
const generation_filters_dto_1 = require("./dto/generation-filters.dto");
const generation_response_dto_1 = require("./dto/generation-response.dto");
let GenerationsController = class GenerationsController {
    generationsService;
    constructor(generationsService) {
        this.generationsService = generationsService;
    }
    async textToImage(userId, dto) {
        return this.generationsService.createGeneration(userId, client_1.GenerationType.TEXT_TO_IMAGE, dto);
    }
    async imageToImage(userId, dto) {
        return this.generationsService.createGeneration(userId, client_1.GenerationType.IMAGE_TO_IMAGE, dto);
    }
    async textToVideo(userId, dto) {
        return this.generationsService.createGeneration(userId, client_1.GenerationType.TEXT_TO_VIDEO, dto);
    }
    async imageToVideo(userId, dto) {
        return this.generationsService.createGeneration(userId, client_1.GenerationType.IMAGE_TO_VIDEO, dto);
    }
    async motionControl(userId, dto) {
        return this.generationsService.createGeneration(userId, client_1.GenerationType.MOTION_CONTROL, dto);
    }
    async findAll(userId, filters) {
        return this.generationsService.findAll(userId, filters);
    }
    async findById(userId, id) {
        return this.generationsService.findById(userId, id);
    }
    async softDelete(userId, id) {
        return this.generationsService.softDelete(userId, id);
    }
    async addFavorite(userId, id) {
        return this.generationsService.toggleFavorite(userId, id, true);
    }
    async removeFavorite(userId, id) {
        return this.generationsService.toggleFavorite(userId, id, false);
    }
};
exports.GenerationsController = GenerationsController;
__decorate([
    (0, common_1.Post)('text-to-image'),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true, whitelist: true })),
    (0, swagger_1.ApiOperation)({ summary: 'Gera imagem a partir de texto' }),
    (0, swagger_1.ApiResponse)({ status: 201, type: generation_response_dto_1.CreateGenerationResponseDto }),
    __param(0, (0, decorators_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, text_to_image_dto_1.TextToImageDto]),
    __metadata("design:returntype", Promise)
], GenerationsController.prototype, "textToImage", null);
__decorate([
    (0, common_1.Post)('image-to-image'),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true, whitelist: true })),
    (0, swagger_1.ApiOperation)({ summary: 'Gera imagem a partir de imagem + prompt' }),
    (0, swagger_1.ApiResponse)({ status: 201, type: generation_response_dto_1.CreateGenerationResponseDto }),
    __param(0, (0, decorators_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, image_to_image_dto_1.ImageToImageDto]),
    __metadata("design:returntype", Promise)
], GenerationsController.prototype, "imageToImage", null);
__decorate([
    (0, common_1.Post)('text-to-video'),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true, whitelist: true })),
    (0, swagger_1.ApiOperation)({ summary: 'Gera vídeo a partir de texto' }),
    (0, swagger_1.ApiResponse)({ status: 201, type: generation_response_dto_1.CreateGenerationResponseDto }),
    __param(0, (0, decorators_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, text_to_video_dto_1.TextToVideoDto]),
    __metadata("design:returntype", Promise)
], GenerationsController.prototype, "textToVideo", null);
__decorate([
    (0, common_1.Post)('image-to-video'),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true, whitelist: true })),
    (0, swagger_1.ApiOperation)({ summary: 'Gera vídeo a partir de imagem' }),
    (0, swagger_1.ApiResponse)({ status: 201, type: generation_response_dto_1.CreateGenerationResponseDto }),
    __param(0, (0, decorators_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, image_to_video_dto_1.ImageToVideoDto]),
    __metadata("design:returntype", Promise)
], GenerationsController.prototype, "imageToVideo", null);
__decorate([
    (0, common_1.Post)('motion-control'),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true, whitelist: true })),
    (0, swagger_1.ApiOperation)({ summary: 'Gera vídeo com motion control' }),
    (0, swagger_1.ApiResponse)({ status: 201, type: generation_response_dto_1.CreateGenerationResponseDto }),
    __param(0, (0, decorators_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, motion_control_dto_1.MotionControlDto]),
    __metadata("design:returntype", Promise)
], GenerationsController.prototype, "motionControl", null);
__decorate([
    (0, common_1.Get)(),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true, whitelist: true })),
    (0, swagger_1.ApiOperation)({ summary: 'Lista gerações do usuário (paginado, com filtros)' }),
    (0, swagger_1.ApiResponse)({ status: 200 }),
    __param(0, (0, decorators_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, generation_filters_dto_1.GenerationFiltersDto]),
    __metadata("design:returntype", Promise)
], GenerationsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Status e detalhes de uma geração' }),
    (0, swagger_1.ApiResponse)({ status: 200, type: generation_response_dto_1.GenerationResponseDto }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'ID da geração' }),
    __param(0, (0, decorators_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], GenerationsController.prototype, "findById", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, swagger_1.ApiOperation)({ summary: 'Soft delete — remove da galeria' }),
    (0, swagger_1.ApiResponse)({ status: 204, description: 'Geração removida com sucesso' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'ID da geração' }),
    __param(0, (0, decorators_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], GenerationsController.prototype, "softDelete", null);
__decorate([
    (0, common_1.Post)(':id/favorite'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, swagger_1.ApiOperation)({ summary: 'Marca geração como favorita' }),
    (0, swagger_1.ApiResponse)({ status: 204, description: 'Marcado como favorito' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'ID da geração' }),
    __param(0, (0, decorators_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], GenerationsController.prototype, "addFavorite", null);
__decorate([
    (0, common_1.Delete)(':id/favorite'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, swagger_1.ApiOperation)({ summary: 'Remove geração dos favoritos' }),
    (0, swagger_1.ApiResponse)({ status: 204, description: 'Removido dos favoritos' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'ID da geração' }),
    __param(0, (0, decorators_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], GenerationsController.prototype, "removeFavorite", null);
exports.GenerationsController = GenerationsController = __decorate([
    (0, swagger_1.ApiTags)('generations'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('api/v1/generations'),
    __metadata("design:paramtypes", [generations_service_1.GenerationsService])
], GenerationsController);
//# sourceMappingURL=generations.controller.js.map