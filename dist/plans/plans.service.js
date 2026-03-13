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
exports.PlansService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let PlansService = class PlansService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAllPlans() {
        return this.prisma.plan.findMany({
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
        });
    }
    async findPlanBySlug(slug) {
        const plan = await this.prisma.plan.findUnique({
            where: { slug },
        });
        if (!plan) {
            throw new common_1.NotFoundException(`Plano "${slug}" não encontrado`);
        }
        return plan;
    }
    async findPlanById(id) {
        const plan = await this.prisma.plan.findUnique({
            where: { id },
        });
        if (!plan) {
            throw new common_1.NotFoundException('Plano não encontrado');
        }
        return plan;
    }
    async getCreditCost(generationType, resolution, hasAudio) {
        console.log(generationType, resolution, hasAudio);
        const cost = await this.prisma.creditCost.findUnique({
            where: {
                generationType_resolution_hasAudio: {
                    generationType,
                    resolution,
                    hasAudio,
                },
            },
        });
        if (!cost) {
            throw new common_1.NotFoundException(`Custo de crédito não encontrado para ${generationType} ${resolution} (audio: ${hasAudio})`);
        }
        return cost;
    }
    async calculateGenerationCost(generationType, resolution, durationSeconds, hasAudio = false, sampleCount = 1) {
        const cost = await this.getCreditCost(generationType, resolution, hasAudio);
        let total = cost.creditsPerUnit;
        if (cost.isPerSecond && durationSeconds) {
            total = cost.creditsPerUnit * durationSeconds;
        }
        return total * Math.max(sampleCount, 1);
    }
    async findAllPackages() {
        return this.prisma.creditPackage.findMany({
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
        });
    }
    async findPackageById(id) {
        const pkg = await this.prisma.creditPackage.findUnique({
            where: { id },
        });
        if (!pkg) {
            throw new common_1.NotFoundException('Pacote de créditos não encontrado');
        }
        return pkg;
    }
};
exports.PlansService = PlansService;
exports.PlansService = PlansService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PlansService);
//# sourceMappingURL=plans.service.js.map