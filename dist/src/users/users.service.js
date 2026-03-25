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
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let UsersService = class UsersService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getProfile(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId, isActive: true },
            include: {
                subscriptions: {
                    where: { status: 'ACTIVE' },
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    include: { plan: true },
                },
                creditBalance: true,
            },
        });
        if (!user) {
            throw new common_1.NotFoundException('Usuário não encontrado');
        }
        const activeSubscription = user.subscriptions[0] || null;
        return {
            id: user.id,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatarUrl,
            role: user.role,
            emailVerified: user.emailVerified,
            createdAt: user.createdAt,
            hasCompletedOnboarding: user.hasCompletedOnboarding,
            plan: activeSubscription
                ? {
                    slug: activeSubscription.plan.slug,
                    name: activeSubscription.plan.name,
                    priceCents: activeSubscription.plan.priceCents,
                    maxConcurrentGenerations: activeSubscription.plan.maxConcurrentGenerations,
                    hasWatermark: activeSubscription.plan.hasWatermark,
                    hasApiAccess: activeSubscription.plan.hasApiAccess,
                }
                : null,
            credits: user.creditBalance
                ? {
                    planCreditsRemaining: user.creditBalance.planCreditsRemaining,
                    bonusCreditsRemaining: user.creditBalance.bonusCreditsRemaining,
                    planCreditsUsed: user.creditBalance.planCreditsUsed,
                    periodStart: user.creditBalance.periodStart,
                    periodEnd: user.creditBalance.periodEnd,
                }
                : null,
            subscription: activeSubscription
                ? {
                    status: activeSubscription.status,
                    currentPeriodStart: activeSubscription.currentPeriodStart,
                    currentPeriodEnd: activeSubscription.currentPeriodEnd,
                    cancelAtPeriodEnd: activeSubscription.cancelAtPeriodEnd,
                }
                : null,
        };
    }
    async updateProfile(userId, dto) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId, isActive: true },
        });
        if (!user) {
            throw new common_1.NotFoundException('Usuário não encontrado');
        }
        await this.prisma.user.update({
            where: { id: userId },
            data: {
                ...(dto.name !== undefined && { name: dto.name }),
                ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
            },
        });
        return this.getProfile(userId);
    }
    async completeOnboarding(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId, isActive: true },
        });
        if (!user) {
            throw new common_1.NotFoundException('Usuário não encontrado');
        }
        if (user.hasCompletedOnboarding) {
            return this.getProfile(userId);
        }
        const ONBOARDING_BONUS_CREDITS = 0;
        await this.prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: userId },
                data: { hasCompletedOnboarding: true },
            });
            await tx.creditBalance.upsert({
                where: { userId },
                create: {
                    userId,
                    planCreditsRemaining: 0,
                    bonusCreditsRemaining: ONBOARDING_BONUS_CREDITS,
                    planCreditsUsed: 0,
                },
                update: {
                    bonusCreditsRemaining: { increment: ONBOARDING_BONUS_CREDITS },
                },
            });
            await tx.creditTransaction.create({
                data: {
                    userId,
                    type: 'ONBOARDING_BONUS',
                    amount: ONBOARDING_BONUS_CREDITS,
                    source: 'bonus',
                    description: 'Bônus por completar o onboarding',
                },
            });
        });
        return this.getProfile(userId);
    }
    async deleteAccount(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId, isActive: true },
        });
        if (!user) {
            throw new common_1.NotFoundException('Usuário não encontrado');
        }
        await this.prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: userId },
                data: { isActive: false },
            });
            await tx.refreshToken.updateMany({
                where: { userId },
                data: { revoked: true },
            });
        });
        return { message: 'Conta desativada com sucesso' };
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UsersService);
//# sourceMappingURL=users.service.js.map