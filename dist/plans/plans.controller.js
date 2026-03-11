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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlansController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const plans_service_1 = require("./plans.service");
const plan_response_dto_1 = require("./dto/plan-response.dto");
const public_decorator_1 = require("../common/decorators/public.decorator");
let PlansController = class PlansController {
    plansService;
    constructor(plansService) {
        this.plansService = plansService;
    }
    async findAll() {
        const plans = await this.plansService.findAllPlans();
        return plans.map((plan) => ({
            id: plan.id,
            slug: plan.slug,
            name: plan.name,
            description: plan.description,
            priceCents: plan.priceCents,
            creditsPerMonth: plan.creditsPerMonth,
            maxConcurrentGenerations: plan.maxConcurrentGenerations,
            hasWatermark: plan.hasWatermark,
            galleryRetentionDays: plan.galleryRetentionDays,
            hasApiAccess: plan.hasApiAccess,
        }));
    }
};
exports.PlansController = PlansController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Lista todos os planos disponíveis' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Lista de planos ativos',
        type: [plan_response_dto_1.PlanResponseDto],
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PlansController.prototype, "findAll", null);
exports.PlansController = PlansController = __decorate([
    (0, swagger_1.ApiTags)('plans'),
    (0, common_1.Controller)('api/v1/plans'),
    __metadata("design:paramtypes", [plans_service_1.PlansService])
], PlansController);
//# sourceMappingURL=plans.controller.js.map