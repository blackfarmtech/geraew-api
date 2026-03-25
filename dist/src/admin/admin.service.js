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
exports.AdminService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
const paginated_response_dto_1 = require("../common/dto/paginated-response.dto");
let AdminService = class AdminService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getStats() {
        const [totalUsers, activeSubscriptions, revenueResult, totalGenerations, pendingCount, processingCount, completedCount, failedCount,] = await Promise.all([
            this.prisma.user.count(),
            this.prisma.subscription.count({
                where: { status: client_1.SubscriptionStatus.ACTIVE },
            }),
            this.prisma.payment.aggregate({
                _sum: { amountCents: true },
                where: { status: 'COMPLETED' },
            }),
            this.prisma.generation.count(),
            this.prisma.generation.count({ where: { status: client_1.GenerationStatus.PENDING } }),
            this.prisma.generation.count({ where: { status: client_1.GenerationStatus.PROCESSING } }),
            this.prisma.generation.count({ where: { status: client_1.GenerationStatus.COMPLETED } }),
            this.prisma.generation.count({ where: { status: client_1.GenerationStatus.FAILED } }),
        ]);
        return {
            totalUsers,
            activeSubscriptions,
            totalRevenueCents: revenueResult._sum.amountCents ?? 0,
            totalGenerations,
            generationsByStatus: {
                pending: pendingCount,
                processing: processingCount,
                completed: completedCount,
                failed: failedCount,
            },
        };
    }
    async getUsers(pagination) {
        const [users, total] = await Promise.all([
            this.prisma.user.findMany({
                orderBy: { createdAt: 'desc' },
                skip: pagination.skip,
                take: pagination.limit,
                include: {
                    subscriptions: {
                        where: { status: client_1.SubscriptionStatus.ACTIVE },
                        include: { plan: true },
                        take: 1,
                    },
                    creditBalance: true,
                },
            }),
            this.prisma.user.count(),
        ]);
        const data = users.map((user) => ({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            isActive: user.isActive,
            createdAt: user.createdAt,
            subscription: user.subscriptions[0]
                ? {
                    planSlug: user.subscriptions[0].plan.slug,
                    planName: user.subscriptions[0].plan.name,
                    status: user.subscriptions[0].status,
                }
                : null,
            credits: user.creditBalance
                ? {
                    planCreditsRemaining: user.creditBalance.planCreditsRemaining,
                    bonusCreditsRemaining: user.creditBalance.bonusCreditsRemaining,
                }
                : null,
        }));
        return new paginated_response_dto_1.PaginatedResponseDto(data, total, pagination.page, pagination.limit);
    }
    async getUserById(id) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            include: {
                subscriptions: {
                    include: { plan: true },
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                },
                creditBalance: true,
                generations: {
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                    include: {
                        outputs: { orderBy: { order: 'asc' } },
                    },
                },
            },
        });
        if (!user) {
            throw new common_1.NotFoundException('Usuário não encontrado');
        }
        return {
            id: user.id,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatarUrl,
            role: user.role,
            isActive: user.isActive,
            emailVerified: user.emailVerified,
            oauthProvider: user.oauthProvider,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            subscription: user.subscriptions[0]
                ? {
                    id: user.subscriptions[0].id,
                    planSlug: user.subscriptions[0].plan.slug,
                    planName: user.subscriptions[0].plan.name,
                    status: user.subscriptions[0].status,
                    currentPeriodStart: user.subscriptions[0].currentPeriodStart,
                    currentPeriodEnd: user.subscriptions[0].currentPeriodEnd,
                    cancelAtPeriodEnd: user.subscriptions[0].cancelAtPeriodEnd,
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
            recentGenerations: user.generations.map((gen) => ({
                id: gen.id,
                type: gen.type,
                status: gen.status,
                prompt: gen.prompt,
                resolution: gen.resolution,
                creditsConsumed: gen.creditsConsumed,
                outputs: gen.outputs?.map((o) => ({
                    url: o.url,
                    thumbnailUrl: o.thumbnailUrl,
                    mimeType: o.mimeType,
                })) ?? [],
                createdAt: gen.createdAt,
                completedAt: gen.completedAt,
            })),
        };
    }
    async adjustCredits(userId, amount, description) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new common_1.NotFoundException('Usuário não encontrado');
        }
        await this.prisma.$transaction(async (tx) => {
            const balance = await tx.creditBalance.findUnique({
                where: { userId },
            });
            if (!balance) {
                await tx.creditBalance.create({
                    data: {
                        userId,
                        bonusCreditsRemaining: Math.max(0, amount),
                        planCreditsRemaining: 0,
                        planCreditsUsed: 0,
                    },
                });
            }
            else {
                const newBonus = balance.bonusCreditsRemaining + amount;
                await tx.creditBalance.update({
                    where: { userId },
                    data: {
                        bonusCreditsRemaining: Math.max(0, newBonus),
                    },
                });
            }
            await tx.creditTransaction.create({
                data: {
                    userId,
                    type: client_1.CreditTransactionType.ADMIN_ADJUSTMENT,
                    amount,
                    source: 'bonus',
                    description,
                },
            });
        });
    }
    async changeUserPlan(userId, planSlug) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new common_1.NotFoundException('Usuário não encontrado');
        }
        const plan = await this.prisma.plan.findUnique({ where: { slug: planSlug } });
        if (!plan) {
            throw new common_1.NotFoundException(`Plano "${planSlug}" não encontrado`);
        }
        if (!plan.isActive) {
            throw new common_1.BadRequestException(`Plano "${planSlug}" não está ativo`);
        }
        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setMonth(periodEnd.getMonth() + 1);
        await this.prisma.$transaction(async (tx) => {
            await tx.subscription.updateMany({
                where: {
                    userId,
                    status: { in: [client_1.SubscriptionStatus.ACTIVE, client_1.SubscriptionStatus.PAST_DUE, client_1.SubscriptionStatus.TRIALING] },
                },
                data: { status: client_1.SubscriptionStatus.CANCELED },
            });
            await tx.subscription.create({
                data: {
                    userId,
                    planId: plan.id,
                    status: client_1.SubscriptionStatus.ACTIVE,
                    currentPeriodStart: now,
                    currentPeriodEnd: periodEnd,
                    paymentProvider: 'admin',
                },
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
                    type: client_1.CreditTransactionType.ADMIN_ADJUSTMENT,
                    amount: plan.creditsPerMonth,
                    source: 'plan',
                    description: `Admin: plano alterado para ${plan.name}`,
                },
            });
        });
    }
    async getGenerations(pagination) {
        const [generations, total] = await Promise.all([
            this.prisma.generation.findMany({
                orderBy: { createdAt: 'desc' },
                skip: pagination.skip,
                take: pagination.limit,
                include: {
                    user: { select: { id: true, email: true, name: true } },
                    outputs: { orderBy: { order: 'asc' } },
                },
            }),
            this.prisma.generation.count(),
        ]);
        const data = generations.map((gen) => ({
            id: gen.id,
            user: gen.user,
            type: gen.type,
            status: gen.status,
            prompt: gen.prompt,
            resolution: gen.resolution,
            durationSeconds: gen.durationSeconds,
            hasAudio: gen.hasAudio,
            creditsConsumed: gen.creditsConsumed,
            outputUrls: gen.outputs?.map((o) => o.url) ?? [],
            errorMessage: gen.errorMessage,
            processingTimeMs: gen.processingTimeMs,
            createdAt: gen.createdAt,
            completedAt: gen.completedAt,
        }));
        return new paginated_response_dto_1.PaginatedResponseDto(data, total, pagination.page, pagination.limit);
    }
    async toggleUserStatus(userId, isActive) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new common_1.NotFoundException('Usuário não encontrado');
        }
        await this.prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: userId },
                data: { isActive },
            });
            if (!isActive) {
                await tx.refreshToken.updateMany({
                    where: { userId, revoked: false },
                    data: { revoked: true },
                });
            }
        });
    }
    async deleteUser(userId) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new common_1.NotFoundException('Usuário não encontrado');
        }
        if (user.role === 'ADMIN') {
            throw new common_1.BadRequestException('Não é possível excluir um administrador');
        }
        await this.prisma.user.delete({ where: { id: userId } });
    }
    async getUserGenerations(userId, pagination) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new common_1.NotFoundException('Usuário não encontrado');
        }
        const where = { userId };
        const [generations, total] = await Promise.all([
            this.prisma.generation.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: pagination.skip,
                take: pagination.limit,
                include: {
                    outputs: { orderBy: { order: 'asc' } },
                },
            }),
            this.prisma.generation.count({ where }),
        ]);
        const data = generations.map((gen) => ({
            id: gen.id,
            type: gen.type,
            status: gen.status,
            prompt: gen.prompt,
            negativePrompt: gen.negativePrompt,
            resolution: gen.resolution,
            durationSeconds: gen.durationSeconds,
            hasAudio: gen.hasAudio,
            modelUsed: gen.modelUsed,
            creditsConsumed: gen.creditsConsumed,
            outputs: gen.outputs.map((o) => ({
                id: o.id,
                url: o.url,
                thumbnailUrl: o.thumbnailUrl,
                mimeType: o.mimeType,
            })),
            inputImages: [],
            isFavorited: gen.isFavorited,
            isDeleted: gen.isDeleted,
            errorMessage: gen.errorMessage,
            processingTimeMs: gen.processingTimeMs,
            createdAt: gen.createdAt,
            completedAt: gen.completedAt,
        }));
        return new paginated_response_dto_1.PaginatedResponseDto(data, total, pagination.page, pagination.limit);
    }
};
exports.AdminService = AdminService;
exports.AdminService = AdminService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AdminService);
//# sourceMappingURL=admin.service.js.map