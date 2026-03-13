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
exports.CreditsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const credits_service_1 = require("./credits.service");
const decorators_1 = require("../common/decorators");
const pagination_dto_1 = require("../common/dto/pagination.dto");
const credit_balance_response_dto_1 = require("./dto/credit-balance-response.dto");
const estimate_cost_dto_1 = require("./dto/estimate-cost.dto");
const purchase_credits_dto_1 = require("./dto/purchase-credits.dto");
const plans_service_1 = require("../plans/plans.service");
const stripe_service_1 = require("../payments/stripe.service");
const prisma_service_1 = require("../prisma/prisma.service");
let CreditsController = class CreditsController {
    creditsService;
    plansService;
    stripeService;
    prisma;
    constructor(creditsService, plansService, stripeService, prisma) {
        this.creditsService = creditsService;
        this.plansService = plansService;
        this.stripeService = stripeService;
        this.prisma = prisma;
    }
    async getBalance(userId) {
        return this.creditsService.getBalance(userId);
    }
    async getTransactions(userId, pagination) {
        return this.creditsService.getTransactions(userId, pagination);
    }
    async getPackages() {
        return this.creditsService.getPackages();
    }
    async purchaseCredits(userId, dto) {
        const pkg = await this.plansService.findPackageById(dto.packageId);
        const user = await this.prisma.user.findUniqueOrThrow({
            where: { id: userId },
            select: { email: true, name: true },
        });
        const customerId = await this.stripeService.getOrCreateCustomer(userId, user.email, user.name);
        const checkoutUrl = await this.stripeService.createCreditPurchaseCheckout(customerId, pkg.id, pkg.name, pkg.credits, pkg.priceCents, userId, pkg.stripePriceId);
        return { checkoutUrl };
    }
    async estimateCost(userId, dto) {
        return this.creditsService.estimateCost(userId, dto.type, dto.resolution, dto.durationSeconds, dto.hasAudio, dto.sampleCount);
    }
};
exports.CreditsController = CreditsController;
__decorate([
    (0, common_1.Get)('balance'),
    (0, swagger_1.ApiOperation)({ summary: 'Saldo detalhado de créditos (plan + bonus)' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Saldo retornado com sucesso',
        type: credit_balance_response_dto_1.CreditBalanceResponseDto,
    }),
    __param(0, (0, decorators_1.CurrentUser)('sub')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CreditsController.prototype, "getBalance", null);
__decorate([
    (0, common_1.Get)('transactions'),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true, whitelist: true })),
    (0, swagger_1.ApiOperation)({ summary: 'Histórico de transações de créditos (paginado)' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Transações retornadas com sucesso',
    }),
    __param(0, (0, decorators_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, pagination_dto_1.PaginationDto]),
    __metadata("design:returntype", Promise)
], CreditsController.prototype, "getTransactions", null);
__decorate([
    (0, common_1.Get)('packages'),
    (0, swagger_1.ApiOperation)({ summary: 'Lista pacotes de créditos disponíveis' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Pacotes retornados com sucesso',
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CreditsController.prototype, "getPackages", null);
__decorate([
    (0, common_1.Post)('purchase'),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true, whitelist: true })),
    (0, swagger_1.ApiOperation)({ summary: 'Compra pacote de créditos (redireciona para Stripe Checkout)' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'URL do checkout retornada com sucesso',
    }),
    __param(0, (0, decorators_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, purchase_credits_dto_1.PurchaseCreditsDto]),
    __metadata("design:returntype", Promise)
], CreditsController.prototype, "purchaseCredits", null);
__decorate([
    (0, common_1.Post)('estimate'),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true, whitelist: true })),
    (0, swagger_1.ApiOperation)({ summary: 'Calcula custo de uma geração antes de executar' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Estimativa calculada com sucesso',
        type: estimate_cost_dto_1.EstimateCostResponseDto,
    }),
    __param(0, (0, decorators_1.CurrentUser)('sub')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, estimate_cost_dto_1.EstimateCostDto]),
    __metadata("design:returntype", Promise)
], CreditsController.prototype, "estimateCost", null);
exports.CreditsController = CreditsController = __decorate([
    (0, swagger_1.ApiTags)('credits'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('api/v1/credits'),
    __metadata("design:paramtypes", [credits_service_1.CreditsService,
        plans_service_1.PlansService,
        stripe_service_1.StripeService,
        prisma_service_1.PrismaService])
], CreditsController);
//# sourceMappingURL=credits.controller.js.map