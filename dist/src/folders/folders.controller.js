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
exports.FoldersController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const folders_service_1 = require("./folders.service");
const decorators_1 = require("../common/decorators");
const create_folder_dto_1 = require("./dto/create-folder.dto");
const update_folder_dto_1 = require("./dto/update-folder.dto");
const add_generations_to_folder_dto_1 = require("./dto/add-generations-to-folder.dto");
const remove_generations_from_folder_dto_1 = require("./dto/remove-generations-from-folder.dto");
const pagination_dto_1 = require("../common/dto/pagination.dto");
let FoldersController = class FoldersController {
    foldersService;
    constructor(foldersService) {
        this.foldersService = foldersService;
    }
    async create(userId, dto) {
        return this.foldersService.create(userId, dto);
    }
    async findAll(userId, pagination) {
        return this.foldersService.findAll(userId, pagination);
    }
    async findOne(userId, folderId, pagination) {
        return this.foldersService.findOne(userId, folderId, pagination);
    }
    async update(userId, folderId, dto) {
        return this.foldersService.update(userId, folderId, dto);
    }
    async remove(userId, folderId) {
        return this.foldersService.remove(userId, folderId);
    }
    async addGenerations(userId, folderId, dto) {
        return this.foldersService.addGenerations(userId, folderId, dto.generationIds);
    }
    async removeGenerations(userId, folderId, dto) {
        return this.foldersService.removeGenerations(userId, folderId, dto.generationIds);
    }
};
exports.FoldersController = FoldersController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true, whitelist: true })),
    (0, swagger_1.ApiOperation)({ summary: 'Criar uma nova pasta' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Pasta criada com sucesso' }),
    __param(0, (0, decorators_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_folder_dto_1.CreateFolderDto]),
    __metadata("design:returntype", Promise)
], FoldersController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true, whitelist: true })),
    (0, swagger_1.ApiOperation)({ summary: 'Listar pastas do usuario' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Pastas retornadas com sucesso' }),
    __param(0, (0, decorators_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, pagination_dto_1.PaginationDto]),
    __metadata("design:returntype", Promise)
], FoldersController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true, whitelist: true })),
    (0, swagger_1.ApiOperation)({ summary: 'Obter pasta com geracoes paginadas' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Pasta retornada com sucesso' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Pasta nao encontrada' }),
    __param(0, (0, decorators_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, pagination_dto_1.PaginationDto]),
    __metadata("design:returntype", Promise)
], FoldersController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true, whitelist: true })),
    (0, swagger_1.ApiOperation)({ summary: 'Atualizar pasta' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Pasta atualizada com sucesso' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Pasta nao encontrada' }),
    __param(0, (0, decorators_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, update_folder_dto_1.UpdateFolderDto]),
    __metadata("design:returntype", Promise)
], FoldersController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, swagger_1.ApiOperation)({ summary: 'Excluir pasta' }),
    (0, swagger_1.ApiResponse)({ status: 204, description: 'Pasta excluida com sucesso' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Pasta nao encontrada' }),
    __param(0, (0, decorators_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], FoldersController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)(':id/generations'),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true, whitelist: true })),
    (0, swagger_1.ApiOperation)({ summary: 'Adicionar geracoes a uma pasta' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Geracoes adicionadas com sucesso' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Pasta nao encontrada' }),
    __param(0, (0, decorators_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, add_generations_to_folder_dto_1.AddGenerationsToFolderDto]),
    __metadata("design:returntype", Promise)
], FoldersController.prototype, "addGenerations", null);
__decorate([
    (0, common_1.Delete)(':id/generations'),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true, whitelist: true })),
    (0, swagger_1.ApiOperation)({ summary: 'Remover geracoes de uma pasta' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Geracoes removidas com sucesso' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Pasta nao encontrada' }),
    __param(0, (0, decorators_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, remove_generations_from_folder_dto_1.RemoveGenerationsFromFolderDto]),
    __metadata("design:returntype", Promise)
], FoldersController.prototype, "removeGenerations", null);
exports.FoldersController = FoldersController = __decorate([
    (0, swagger_1.ApiTags)('folders'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('api/v1/folders'),
    __metadata("design:paramtypes", [folders_service_1.FoldersService])
], FoldersController);
//# sourceMappingURL=folders.controller.js.map