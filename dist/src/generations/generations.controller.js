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
const rxjs_1 = require("rxjs");
const generations_service_1 = require("./generations.service");
const generation_events_service_1 = require("./generation-events.service");
const decorators_1 = require("../common/decorators");
const generation_filters_dto_1 = require("./dto/generation-filters.dto");
const generation_response_dto_1 = require("./dto/generation-response.dto");
const folder_response_dto_1 = require("../folders/dto/folder-response.dto");
const generate_image_dto_1 = require("./dto/generate-image.dto");
const generate_image_nano_banana_dto_1 = require("./dto/generate-image-nano-banana.dto");
const generate_video_text_to_video_dto_1 = require("./dto/videos/generate-video-text-to-video.dto");
const generate_video_image_to_video_dto_1 = require("./dto/videos/generate-video-image-to-video.dto");
const generate_video_with_references_dto_1 = require("./dto/videos/generate-video-with-references.dto");
const generate_motion_control_dto_1 = require("./dto/videos/generate-motion-control.dto");
let GenerationsController = class GenerationsController {
    generationsService;
    generationEvents;
    constructor(generationsService, generationEvents) {
        this.generationsService = generationsService;
        this.generationEvents = generationEvents;
    }
    sseAll(userId) {
        const events$ = this.generationEvents.subscribe(userId).pipe((0, rxjs_1.map)((event) => ({ data: event })));
        const heartbeat$ = (0, rxjs_1.interval)(20_000).pipe((0, rxjs_1.map)(() => ({ data: { type: 'heartbeat' } })));
        return (0, rxjs_1.merge)(events$, heartbeat$);
    }
    sseOne(userId, id) {
        const events$ = this.generationEvents.subscribeToGeneration(userId, id).pipe((0, rxjs_1.map)((event) => ({ data: event })));
        const heartbeat$ = (0, rxjs_1.interval)(20_000).pipe((0, rxjs_1.map)(() => ({ data: { type: 'heartbeat' } })));
        return (0, rxjs_1.merge)(events$, heartbeat$);
    }
    async generateImage(userId, dto) {
        return this.generationsService.generateImage(userId, dto);
    }
    async generateImageWithFallback(userId, dto) {
        return this.generationsService.generateImageWithFallback(userId, dto);
    }
    async generateImageNanoBanana(userId, dto) {
        return this.generationsService.generateImageNanoBanana(userId, dto);
    }
    async textToVideo(userId, dto) {
        return this.generationsService.generateTextToVideo(userId, dto);
    }
    async imageToVideo(userId, dto) {
        return this.generationsService.generateImageToVideo(userId, dto);
    }
    async videoWithReferences(userId, dto) {
        return this.generationsService.generateVideoWithReferences(userId, dto);
    }
    async motionControl(userId, dto) {
        return this.generationsService.generateMotionControl(userId, dto);
    }
    async findAll(userId, filters) {
        return this.generationsService.findAll(userId, filters);
    }
    async findById(userId, id) {
        return this.generationsService.findById(userId, id);
    }
    async findFolders(userId, id) {
        return this.generationsService.findFolders(userId, id);
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
    (0, common_1.Sse)('events'),
    (0, swagger_1.ApiOperation)({ summary: 'SSE — recebe eventos de todas as gerações do usuário em tempo real' }),
    __param(0, (0, decorators_1.CurrentUser)('sub')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", rxjs_1.Observable)
], GenerationsController.prototype, "sseAll", null);
__decorate([
    (0, common_1.Sse)(':id/events'),
    (0, swagger_1.ApiOperation)({ summary: 'SSE — recebe eventos de uma geração específica em tempo real' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'ID da geração' }),
    __param(0, (0, decorators_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", rxjs_1.Observable)
], GenerationsController.prototype, "sseOne", null);
__decorate([
    (0, common_1.Post)('generate-image'),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true, whitelist: true })),
    (0, swagger_1.ApiOperation)({ summary: 'Gera imagem (text-to-image ou image-to-image)' }),
    (0, swagger_1.ApiResponse)({ status: 201, type: generation_response_dto_1.CreateGenerationResponseDto }),
    __param(0, (0, decorators_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, generate_image_dto_1.GenerateImageDto]),
    __metadata("design:returntype", Promise)
], GenerationsController.prototype, "generateImage", null);
__decorate([
    (0, common_1.Post)('generate-image-auto'),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true, whitelist: true })),
    (0, swagger_1.ApiOperation)({
        summary: 'Gera imagem tentando Geraew (Gemini) primeiro; se falhar, usa Nano Banana 2 como fallback',
    }),
    (0, swagger_1.ApiResponse)({ status: 201, type: generation_response_dto_1.CreateGenerationResponseDto }),
    __param(0, (0, decorators_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, generate_image_dto_1.GenerateImageDto]),
    __metadata("design:returntype", Promise)
], GenerationsController.prototype, "generateImageWithFallback", null);
__decorate([
    (0, common_1.Post)('generate-image-nano-banana'),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true, whitelist: true })),
    (0, swagger_1.ApiOperation)({ summary: 'Gera imagem via Nano Banana 2 (kie-api) — text-to-image ou image-to-image' }),
    (0, swagger_1.ApiResponse)({ status: 201, type: generation_response_dto_1.CreateGenerationResponseDto }),
    __param(0, (0, decorators_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, generate_image_nano_banana_dto_1.GenerateImageNanoBananaDto]),
    __metadata("design:returntype", Promise)
], GenerationsController.prototype, "generateImageNanoBanana", null);
__decorate([
    (0, common_1.Post)('text-to-video'),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true, whitelist: true })),
    (0, swagger_1.ApiOperation)({ summary: 'Gera vídeo a partir de texto' }),
    (0, swagger_1.ApiResponse)({ status: 201, type: generation_response_dto_1.CreateGenerationResponseDto }),
    __param(0, (0, decorators_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, generate_video_text_to_video_dto_1.GenerateVideoTextToVideoDto]),
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
    __metadata("design:paramtypes", [String, generate_video_image_to_video_dto_1.GenerateVideoImageToVideoDto]),
    __metadata("design:returntype", Promise)
], GenerationsController.prototype, "imageToVideo", null);
__decorate([
    (0, common_1.Post)('video-with-references'),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true, whitelist: true })),
    (0, swagger_1.ApiOperation)({ summary: 'Gera vídeo com imagens de referência' }),
    (0, swagger_1.ApiResponse)({ status: 201, type: generation_response_dto_1.CreateGenerationResponseDto }),
    __param(0, (0, decorators_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, generate_video_with_references_dto_1.GenerateVideoWithReferencesDto]),
    __metadata("design:returntype", Promise)
], GenerationsController.prototype, "videoWithReferences", null);
__decorate([
    (0, common_1.Post)('motion-control'),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true, whitelist: true })),
    (0, swagger_1.ApiOperation)({ summary: 'Motion Control — Wan Animate Replace (vídeo + imagem → vídeo)' }),
    (0, swagger_1.ApiResponse)({ status: 201, type: generation_response_dto_1.CreateGenerationResponseDto }),
    __param(0, (0, decorators_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, generate_motion_control_dto_1.GenerateMotionControlDto]),
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
    (0, common_1.Get)(':id/folders'),
    (0, swagger_1.ApiOperation)({ summary: 'Lista as pastas em que uma geração está' }),
    (0, swagger_1.ApiResponse)({ status: 200, type: [folder_response_dto_1.FolderResponseDto] }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'ID da geração' }),
    __param(0, (0, decorators_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], GenerationsController.prototype, "findFolders", null);
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
    __metadata("design:paramtypes", [generations_service_1.GenerationsService,
        generation_events_service_1.GenerationEventsService])
], GenerationsController);
//# sourceMappingURL=generations.controller.js.map