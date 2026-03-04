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
exports.SubscriptionsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const plans_service_1 = require("../plans/plans.service");
const PLAN_ORDER = ['free', 'starter', 'pro', 'business'];
let SubscriptionsService = class SubscriptionsService {
    prisma;
    plansService;
    constructor(prisma, plansService) {
        this.prisma = prisma;
        this.plansService = plansService;
    }
    async getCurrentSubscription(userId) {
        const subscription = await this.prisma.subscription.findFirst({
            where: {
                userId,
                status: { in: ['ACTIVE', 'PAST_DUE', 'TRIALING'] },
            },
            orderBy: { createdAt: 'desc' },
            include: { plan: true },
        });
        if (!subscription) {
            return null;
        }
        return this.toResponseDto(subscription);
    }
    async createSubscription(userId, planSlug) {
        const plan = await this.plansService.findPlanBySlug(planSlug);
        if (plan.slug === 'free') {
            throw new common_1.BadRequestException('Não é possível criar assinatura para o plano Free');
        }
        const existing = await this.prisma.subscription.findFirst({
            where: {
                userId,
                status: { in: ['ACTIVE', 'TRIALING'] },
            },
        });
        if (existing) {
            throw new common_1.ConflictException('Usuário já possui uma assinatura ativa. Use upgrade ou downgrade.');
        }
        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setMonth(periodEnd.getMonth() + 1);
        const subscription = await this.prisma.$transaction(async (tx) => {
            const sub = await tx.subscription.create({
                data: {
                    userId,
                    planId: plan.id,
                    status: 'ACTIVE',
                    currentPeriodStart: now,
                    currentPeriodEnd: periodEnd,
                },
                include: { plan: true },
            });
            await tx.creditBalance.upsert({
                where: { userId },
                create: {
                    userId,
                    planCreditsRemaining: plan.creditsPerMonth,
                    bonusCreditsRemaining: 0,
                    planCreditsUsed: 0,
                    periodStart: now,
                    periodEnd: periodEnd,
                },
                update: {
                    planCreditsRemaining: plan.creditsPerMonth,
                    planCreditsUsed: 0,
                    periodStart: now,
                    periodEnd: periodEnd,
                },
            });
            await tx.creditTransaction.create({
                data: {
                    userId,
                    type: 'SUBSCRIPTION_RENEWAL',
                    amount: plan.creditsPerMonth,
                    source: 'plan',
                    description: `Assinatura criada — plano ${plan.name}`,
                },
            });
            return sub;
        });
        return this.toResponseDto(subscription);
    }
    async upgrade(userId, planSlug) {
        const current = await this.prisma.subscription.findFirst({
            where: {
                userId,
                status: { in: ['ACTIVE', 'TRIALING'] },
            },
            include: { plan: true },
        });
        if (!current) {
            throw new common_1.NotFoundException('Nenhuma assinatura ativa encontrada');
        }
        const newPlan = await this.plansService.findPlanBySlug(planSlug);
        const currentIdx = PLAN_ORDER.indexOf(current.plan.slug);
        const newIdx = PLAN_ORDER.indexOf(newPlan.slug);
        if (newIdx <= currentIdx) {
            throw new common_1.BadRequestException(`O plano "${newPlan.slug}" não é superior ao plano atual "${current.plan.slug}". Use downgrade.`);
        }
        const now = new Date();
        const periodTotal = current.currentPeriodEnd.getTime() -
            current.currentPeriodStart.getTime();
        const periodRemaining = current.currentPeriodEnd.getTime() - now.getTime();
        const remainingRatio = Math.max(0, periodRemaining / periodTotal);
        const proRataCredits = Math.floor(newPlan.creditsPerMonth * remainingRatio);
        const subscription = await this.prisma.$transaction(async (tx) => {
            const sub = await tx.subscription.update({
                where: { id: current.id },
                data: {
                    planId: newPlan.id,
                    cancelAtPeriodEnd: false,
                },
                include: { plan: true },
            });
            const balance = await tx.creditBalance.findUnique({
                where: { userId },
            });
            const currentPlanRemaining = balance?.planCreditsRemaining ?? 0;
            await tx.creditBalance.upsert({
                where: { userId },
                create: {
                    userId,
                    planCreditsRemaining: proRataCredits,
                    bonusCreditsRemaining: 0,
                    planCreditsUsed: 0,
                    periodStart: current.currentPeriodStart,
                    periodEnd: current.currentPeriodEnd,
                },
                update: {
                    planCreditsRemaining: proRataCredits,
                },
            });
            const creditsDiff = proRataCredits - currentPlanRemaining;
            if (creditsDiff !== 0) {
                await tx.creditTransaction.create({
                    data: {
                        userId,
                        type: 'SUBSCRIPTION_RENEWAL',
                        amount: creditsDiff,
                        source: 'plan',
                        description: `Upgrade para ${newPlan.name} — ajuste pro-rata de créditos`,
                    },
                });
            }
            return sub;
        });
        return this.toResponseDto(subscription);
    }
    async downgrade(userId, planSlug) {
        const current = await this.prisma.subscription.findFirst({
            where: {
                userId,
                status: { in: ['ACTIVE', 'TRIALING'] },
            },
            include: { plan: true },
        });
        if (!current) {
            throw new common_1.NotFoundException('Nenhuma assinatura ativa encontrada');
        }
        const newPlan = await this.plansService.findPlanBySlug(planSlug);
        const currentIdx = PLAN_ORDER.indexOf(current.plan.slug);
        const newIdx = PLAN_ORDER.indexOf(newPlan.slug);
        if (newIdx >= currentIdx) {
            throw new common_1.BadRequestException(`O plano "${newPlan.slug}" não é inferior ao plano atual "${current.plan.slug}". Use upgrade.`);
        }
        const subscription = await this.prisma.subscription.update({
            where: { id: current.id },
            data: {
                cancelAtPeriodEnd: true,
            },
            include: { plan: true },
        });
        return this.toResponseDto(subscription);
    }
    async cancel(userId) {
        const current = await this.prisma.subscription.findFirst({
            where: {
                userId,
                status: 'ACTIVE',
            },
            include: { plan: true },
        });
        if (!current) {
            throw new common_1.NotFoundException('Nenhuma assinatura ativa encontrada');
        }
        if (current.cancelAtPeriodEnd) {
            throw new common_1.BadRequestException('Assinatura já está marcada para cancelamento');
        }
        const subscription = await this.prisma.subscription.update({
            where: { id: current.id },
            data: { cancelAtPeriodEnd: true },
            include: { plan: true },
        });
        return this.toResponseDto(subscription);
    }
    async reactivate(userId) {
        const current = await this.prisma.subscription.findFirst({
            where: {
                userId,
                status: 'ACTIVE',
                cancelAtPeriodEnd: true,
            },
            include: { plan: true },
        });
        if (!current) {
            throw new common_1.NotFoundException('Nenhuma assinatura ativa com cancelamento pendente encontrada');
        }
        const subscription = await this.prisma.subscription.update({
            where: { id: current.id },
            data: { cancelAtPeriodEnd: false },
            include: { plan: true },
        });
        return this.toResponseDto(subscription);
    }
    toResponseDto(subscription) {
        return {
            id: subscription.id,
            status: subscription.status,
            currentPeriodStart: subscription.currentPeriodStart,
            currentPeriodEnd: subscription.currentPeriodEnd,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            paymentProvider: subscription.paymentProvider,
            paymentRetryCount: subscription.paymentRetryCount,
            createdAt: subscription.createdAt,
            plan: {
                id: subscription.plan.id,
                slug: subscription.plan.slug,
                name: subscription.plan.name,
                priceCents: subscription.plan.priceCents,
                creditsPerMonth: subscription.plan.creditsPerMonth,
                maxConcurrentGenerations: subscription.plan.maxConcurrentGenerations,
                hasWatermark: subscription.plan.hasWatermark,
                galleryRetentionDays: subscription.plan.galleryRetentionDays,
                hasApiAccess: subscription.plan.hasApiAccess,
            },
        };
    }
};
exports.SubscriptionsService = SubscriptionsService;
exports.SubscriptionsService = SubscriptionsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        plans_service_1.PlansService])
], SubscriptionsService);
//# sourceMappingURL=subscriptions.service.js.map