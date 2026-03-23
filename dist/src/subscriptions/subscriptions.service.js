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
const stripe_service_1 = require("../payments/stripe.service");
const PLAN_ORDER = ['free', 'starter', 'creator', 'pro', 'studio'];
let SubscriptionsService = class SubscriptionsService {
    prisma;
    plansService;
    stripeService;
    constructor(prisma, plansService, stripeService) {
        this.prisma = prisma;
        this.plansService = plansService;
        this.stripeService = stripeService;
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
                plan: { slug: { not: 'free' } },
            },
            include: { plan: true },
        });
        if (existing) {
            throw new common_1.ConflictException('Usuário já possui uma assinatura ativa. Use upgrade ou downgrade.');
        }
        const user = await this.prisma.user.findUniqueOrThrow({
            where: { id: userId },
            select: { email: true, name: true },
        });
        const customerId = await this.stripeService.getOrCreateCustomer(userId, user.email, user.name);
        const checkoutUrl = await this.stripeService.createSubscriptionCheckout(customerId, plan.slug, plan.name, plan.priceCents, userId, plan.stripePriceId);
        return { checkoutUrl };
    }
    async upgrade(userId, planSlug) {
        const current = await this.prisma.subscription.findFirst({
            where: {
                userId,
                status: { in: ['ACTIVE', 'TRIALING'] },
            },
            orderBy: { createdAt: 'desc' },
            include: { plan: true },
        });
        const newPlan = await this.plansService.findPlanBySlug(planSlug);
        let discountAmountCents = 0;
        if (current) {
            const currentIdx = PLAN_ORDER.indexOf(current.plan.slug);
            const newIdx = PLAN_ORDER.indexOf(newPlan.slug);
            if (newIdx === currentIdx) {
                throw new common_1.BadRequestException('Você já está neste plano.');
            }
            if (newIdx > currentIdx && current.plan.slug !== 'free') {
                discountAmountCents = current.plan.priceCents;
            }
            if (current.externalSubscriptionId) {
                await this.stripeService.cancelSubscription(current.externalSubscriptionId).catch(() => { });
            }
            await this.prisma.subscription.update({
                where: { id: current.id },
                data: { cancelAtPeriodEnd: true },
            });
        }
        const checkoutUrl = await this.buildCheckoutForPlan(userId, planSlug, discountAmountCents);
        return { checkoutUrl };
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
        if (newIdx === currentIdx) {
            throw new common_1.BadRequestException('Você já está neste plano.');
        }
        if (newIdx > currentIdx) {
            throw new common_1.BadRequestException(`O plano "${newPlan.slug}" não é inferior ao atual. Use upgrade.`);
        }
        if (newPlan.slug === 'free') {
            if (current.externalSubscriptionId) {
                await this.stripeService.cancelSubscription(current.externalSubscriptionId);
            }
            const subscription = await this.prisma.subscription.update({
                where: { id: current.id },
                data: {
                    cancelAtPeriodEnd: true,
                    scheduledPlanId: newPlan.id,
                },
                include: { plan: true, scheduledPlan: true },
            });
            return this.toResponseDto(subscription);
        }
        if (!current.externalSubscriptionId) {
            throw new common_1.BadRequestException('Assinatura sem vínculo com Stripe');
        }
        if (!newPlan.stripePriceId) {
            throw new common_1.BadRequestException('Plano de destino sem price ID no Stripe');
        }
        await this.stripeService.scheduleSubscriptionPlanChange(current.externalSubscriptionId, newPlan.stripePriceId);
        const subscription = await this.prisma.subscription.update({
            where: { id: current.id },
            data: { scheduledPlanId: newPlan.id },
            include: { plan: true, scheduledPlan: true },
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
        if (current.externalSubscriptionId) {
            await this.stripeService.cancelSubscription(current.externalSubscriptionId);
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
        if (current.externalSubscriptionId) {
            await this.stripeService.reactivateSubscription(current.externalSubscriptionId);
        }
        const subscription = await this.prisma.subscription.update({
            where: { id: current.id },
            data: { cancelAtPeriodEnd: false },
            include: { plan: true },
        });
        return this.toResponseDto(subscription);
    }
    async buildCheckoutForPlan(userId, planSlug, discountAmountCents = 0) {
        const plan = await this.plansService.findPlanBySlug(planSlug);
        const user = await this.prisma.user.findUniqueOrThrow({
            where: { id: userId },
            select: { email: true, name: true },
        });
        const customerId = await this.stripeService.getOrCreateCustomer(userId, user.email, user.name);
        return this.stripeService.createSubscriptionCheckout(customerId, plan.slug, plan.name, plan.priceCents, userId, plan.stripePriceId, discountAmountCents > 0 ? discountAmountCents : undefined);
    }
    toResponseDto(subscription) {
        const dto = {
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
        if (subscription.scheduledPlan) {
            dto.scheduledPlan = {
                id: subscription.scheduledPlan.id,
                slug: subscription.scheduledPlan.slug,
                name: subscription.scheduledPlan.name,
                priceCents: subscription.scheduledPlan.priceCents,
                creditsPerMonth: subscription.scheduledPlan.creditsPerMonth,
            };
        }
        return dto;
    }
};
exports.SubscriptionsService = SubscriptionsService;
exports.SubscriptionsService = SubscriptionsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        plans_service_1.PlansService,
        stripe_service_1.StripeService])
], SubscriptionsService);
//# sourceMappingURL=subscriptions.service.js.map