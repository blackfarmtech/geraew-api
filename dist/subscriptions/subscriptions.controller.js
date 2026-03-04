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
exports.SubscriptionsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const subscriptions_service_1 = require("./subscriptions.service");
const create_subscription_dto_1 = require("./dto/create-subscription.dto");
const subscription_response_dto_1 = require("./dto/subscription-response.dto");
const decorators_1 = require("../common/decorators");
let SubscriptionsController = class SubscriptionsController {
    subscriptionsService;
    constructor(subscriptionsService) {
        this.subscriptionsService = subscriptionsService;
    }
    async getCurrent(userId) {
        return this.subscriptionsService.getCurrentSubscription(userId);
    }
    async create(userId, dto) {
        return this.subscriptionsService.createSubscription(userId, dto.planSlug);
    }
    async upgrade(userId, dto) {
        return this.subscriptionsService.upgrade(userId, dto.planSlug);
    }
    async downgrade(userId, dto) {
        return this.subscriptionsService.downgrade(userId, dto.planSlug);
    }
    async cancel(userId) {
        return this.subscriptionsService.cancel(userId);
    }
    async reactivate(userId) {
        return this.subscriptionsService.reactivate(userId);
    }
};
exports.SubscriptionsController = SubscriptionsController;
__decorate([
    (0, common_1.Get)('current'),
    (0, swagger_1.ApiOperation)({ summary: 'Assinatura atual do usuário' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Assinatura retornada com sucesso',
        type: subscription_response_dto_1.SubscriptionResponseDto,
    }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Não autenticado' }),
    __param(0, (0, decorators_1.CurrentUser)('sub')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SubscriptionsController.prototype, "getCurrent", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true, whitelist: true })),
    (0, swagger_1.ApiOperation)({ summary: 'Criar assinatura' }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: 'Assinatura criada com sucesso',
        type: subscription_response_dto_1.SubscriptionResponseDto,
    }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Dados inválidos' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Não autenticado' }),
    (0, swagger_1.ApiResponse)({ status: 409, description: 'Já possui assinatura ativa' }),
    __param(0, (0, decorators_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_subscription_dto_1.CreateSubscriptionDto]),
    __metadata("design:returntype", Promise)
], SubscriptionsController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)('upgrade'),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true, whitelist: true })),
    (0, swagger_1.ApiOperation)({ summary: 'Upgrade de plano' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Upgrade realizado com sucesso',
        type: subscription_response_dto_1.SubscriptionResponseDto,
    }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Plano não é superior ao atual' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Não autenticado' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Nenhuma assinatura ativa' }),
    __param(0, (0, decorators_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_subscription_dto_1.CreateSubscriptionDto]),
    __metadata("design:returntype", Promise)
], SubscriptionsController.prototype, "upgrade", null);
__decorate([
    (0, common_1.Patch)('downgrade'),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true, whitelist: true })),
    (0, swagger_1.ApiOperation)({ summary: 'Downgrade de plano (efetivo próximo ciclo)' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Downgrade agendado para o próximo ciclo',
        type: subscription_response_dto_1.SubscriptionResponseDto,
    }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Plano não é inferior ao atual' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Não autenticado' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Nenhuma assinatura ativa' }),
    __param(0, (0, decorators_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_subscription_dto_1.CreateSubscriptionDto]),
    __metadata("design:returntype", Promise)
], SubscriptionsController.prototype, "downgrade", null);
__decorate([
    (0, common_1.Post)('cancel'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Cancelar assinatura (acesso até fim do período)' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Assinatura marcada para cancelamento',
        type: subscription_response_dto_1.SubscriptionResponseDto,
    }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Assinatura já cancelada' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Não autenticado' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Nenhuma assinatura ativa' }),
    __param(0, (0, decorators_1.CurrentUser)('sub')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SubscriptionsController.prototype, "cancel", null);
__decorate([
    (0, common_1.Post)('reactivate'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Reativar assinatura cancelada' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Assinatura reativada com sucesso',
        type: subscription_response_dto_1.SubscriptionResponseDto,
    }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Não autenticado' }),
    (0, swagger_1.ApiResponse)({
        status: 404,
        description: 'Nenhuma assinatura com cancelamento pendente',
    }),
    __param(0, (0, decorators_1.CurrentUser)('sub')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SubscriptionsController.prototype, "reactivate", null);
exports.SubscriptionsController = SubscriptionsController = __decorate([
    (0, swagger_1.ApiTags)('subscriptions'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('api/v1/subscriptions'),
    __metadata("design:paramtypes", [subscriptions_service_1.SubscriptionsService])
], SubscriptionsController);
//# sourceMappingURL=subscriptions.controller.js.map