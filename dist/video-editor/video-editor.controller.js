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
exports.VideoEditorController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const video_editor_service_1 = require("./video-editor.service");
const decorators_1 = require("../common/decorators");
const create_project_dto_1 = require("./dto/create-project.dto");
const update_project_dto_1 = require("./dto/update-project.dto");
const add_clip_dto_1 = require("./dto/add-clip.dto");
const update_clip_dto_1 = require("./dto/update-clip.dto");
const reorder_clips_dto_1 = require("./dto/reorder-clips.dto");
const pagination_dto_1 = require("../common/dto/pagination.dto");
let VideoEditorController = class VideoEditorController {
    videoEditorService;
    constructor(videoEditorService) {
        this.videoEditorService = videoEditorService;
    }
    async createProject(userId, dto) {
        return this.videoEditorService.createProject(userId, dto);
    }
    async listProjects(userId, pagination) {
        return this.videoEditorService.listProjects(userId, pagination);
    }
    async getProject(userId, projectId) {
        return this.videoEditorService.getProject(userId, projectId);
    }
    async updateProject(userId, projectId, dto) {
        return this.videoEditorService.updateProject(userId, projectId, dto);
    }
    async deleteProject(userId, projectId) {
        return this.videoEditorService.deleteProject(userId, projectId);
    }
    async addClip(userId, projectId, dto) {
        return this.videoEditorService.addClip(userId, projectId, dto);
    }
    async updateClip(userId, projectId, clipId, dto) {
        return this.videoEditorService.updateClip(userId, projectId, clipId, dto);
    }
    async deleteClip(userId, projectId, clipId) {
        return this.videoEditorService.deleteClip(userId, projectId, clipId);
    }
    async reorderClips(userId, projectId, dto) {
        return this.videoEditorService.reorderClips(userId, projectId, dto.clipIds);
    }
    async render(userId, projectId) {
        return this.videoEditorService.render(userId, projectId);
    }
};
exports.VideoEditorController = VideoEditorController;
__decorate([
    (0, common_1.Post)('projects'),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true, whitelist: true })),
    (0, swagger_1.ApiOperation)({ summary: 'Criar um novo projeto de video' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Projeto criado com sucesso' }),
    __param(0, (0, decorators_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_project_dto_1.CreateProjectDto]),
    __metadata("design:returntype", Promise)
], VideoEditorController.prototype, "createProject", null);
__decorate([
    (0, common_1.Get)('projects'),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true, whitelist: true })),
    (0, swagger_1.ApiOperation)({ summary: 'Listar projetos do usuario' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Projetos retornados com sucesso' }),
    __param(0, (0, decorators_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, pagination_dto_1.PaginationDto]),
    __metadata("design:returntype", Promise)
], VideoEditorController.prototype, "listProjects", null);
__decorate([
    (0, common_1.Get)('projects/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Obter projeto com clips' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Projeto retornado com sucesso' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Projeto nao encontrado' }),
    __param(0, (0, decorators_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], VideoEditorController.prototype, "getProject", null);
__decorate([
    (0, common_1.Patch)('projects/:id'),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true, whitelist: true })),
    (0, swagger_1.ApiOperation)({ summary: 'Atualizar nome do projeto' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Projeto atualizado com sucesso' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Projeto nao encontrado' }),
    __param(0, (0, decorators_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, update_project_dto_1.UpdateProjectDto]),
    __metadata("design:returntype", Promise)
], VideoEditorController.prototype, "updateProject", null);
__decorate([
    (0, common_1.Delete)('projects/:id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, swagger_1.ApiOperation)({ summary: 'Excluir projeto' }),
    (0, swagger_1.ApiResponse)({ status: 204, description: 'Projeto excluido com sucesso' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Projeto nao encontrado' }),
    __param(0, (0, decorators_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], VideoEditorController.prototype, "deleteProject", null);
__decorate([
    (0, common_1.Post)('projects/:id/clips'),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true, whitelist: true })),
    (0, swagger_1.ApiOperation)({ summary: 'Adicionar clip ao projeto' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Clip adicionado com sucesso' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Projeto nao encontrado' }),
    __param(0, (0, decorators_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, add_clip_dto_1.AddClipDto]),
    __metadata("design:returntype", Promise)
], VideoEditorController.prototype, "addClip", null);
__decorate([
    (0, common_1.Patch)('projects/:id/clips/:clipId'),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true, whitelist: true })),
    (0, swagger_1.ApiOperation)({ summary: 'Atualizar corte do clip' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Clip atualizado com sucesso' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Clip nao encontrado' }),
    __param(0, (0, decorators_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('clipId')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, update_clip_dto_1.UpdateClipDto]),
    __metadata("design:returntype", Promise)
], VideoEditorController.prototype, "updateClip", null);
__decorate([
    (0, common_1.Delete)('projects/:id/clips/:clipId'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, swagger_1.ApiOperation)({ summary: 'Remover clip do projeto' }),
    (0, swagger_1.ApiResponse)({ status: 204, description: 'Clip removido com sucesso' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Clip nao encontrado' }),
    __param(0, (0, decorators_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('clipId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], VideoEditorController.prototype, "deleteClip", null);
__decorate([
    (0, common_1.Post)('projects/:id/reorder'),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true, whitelist: true })),
    (0, swagger_1.ApiOperation)({ summary: 'Reordenar clips do projeto' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Clips reordenados com sucesso' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Projeto nao encontrado' }),
    __param(0, (0, decorators_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, reorder_clips_dto_1.ReorderClipsDto]),
    __metadata("design:returntype", Promise)
], VideoEditorController.prototype, "reorderClips", null);
__decorate([
    (0, common_1.Post)('projects/:id/render'),
    (0, common_1.HttpCode)(common_1.HttpStatus.ACCEPTED),
    (0, swagger_1.ApiOperation)({ summary: 'Iniciar renderizacao do projeto' }),
    (0, swagger_1.ApiResponse)({ status: 202, description: 'Renderizacao iniciada' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Projeto sem clips ou ja processando' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Projeto nao encontrado' }),
    __param(0, (0, decorators_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], VideoEditorController.prototype, "render", null);
exports.VideoEditorController = VideoEditorController = __decorate([
    (0, swagger_1.ApiTags)('video-editor'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('api/v1/video-editor'),
    __metadata("design:paramtypes", [video_editor_service_1.VideoEditorService])
], VideoEditorController);
//# sourceMappingURL=video-editor.controller.js.map