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
exports.UsersController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const users_service_1 = require("./users.service");
const update_user_dto_1 = require("./dto/update-user.dto");
const user_profile_response_dto_1 = require("./dto/user-profile-response.dto");
const decorators_1 = require("../common/decorators");
let UsersController = class UsersController {
    usersService;
    constructor(usersService) {
        this.usersService = usersService;
    }
    async getProfile(userId) {
        return this.usersService.getProfile(userId);
    }
    async updateProfile(userId, dto) {
        return this.usersService.updateProfile(userId, dto);
    }
    async completeOnboarding(userId) {
        return this.usersService.completeOnboarding(userId);
    }
    async deleteAccount(userId) {
        return this.usersService.deleteAccount(userId);
    }
};
exports.UsersController = UsersController;
__decorate([
    (0, common_1.Get)('me'),
    (0, swagger_1.ApiOperation)({ summary: 'Perfil do usuário logado' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Perfil retornado com sucesso',
        type: user_profile_response_dto_1.UserProfileResponseDto,
    }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Não autenticado' }),
    __param(0, (0, decorators_1.CurrentUser)('sub')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "getProfile", null);
__decorate([
    (0, common_1.Patch)('me'),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true, whitelist: true })),
    (0, swagger_1.ApiOperation)({ summary: 'Atualizar perfil' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Perfil atualizado com sucesso',
        type: user_profile_response_dto_1.UserProfileResponseDto,
    }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Não autenticado' }),
    __param(0, (0, decorators_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_user_dto_1.UpdateUserDto]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "updateProfile", null);
__decorate([
    (0, common_1.Patch)('me/onboarding'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Marcar onboarding como concluído' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Onboarding concluído',
        type: user_profile_response_dto_1.UserProfileResponseDto,
    }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Não autenticado' }),
    __param(0, (0, decorators_1.CurrentUser)('sub')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "completeOnboarding", null);
__decorate([
    (0, common_1.Delete)('me'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Desativar conta (soft delete)' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Conta desativada com sucesso',
    }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Não autenticado' }),
    __param(0, (0, decorators_1.CurrentUser)('sub')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], UsersController.prototype, "deleteAccount", null);
exports.UsersController = UsersController = __decorate([
    (0, swagger_1.ApiTags)('users'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('api/v1/users'),
    __metadata("design:paramtypes", [users_service_1.UsersService])
], UsersController);
//# sourceMappingURL=users.controller.js.map