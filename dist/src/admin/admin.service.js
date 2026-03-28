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
var AdminService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
const paginated_response_dto_1 = require("../common/dto/paginated-response.dto");
let AdminService = class AdminService {
    static { AdminService_1 = this; }
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    static GERAEW_MODEL_PREFIXES = ['gemini-', 'veo-'];
    static API_COST_MAP = {
        'nano-banana-2:RES_1K': 23,
        'nano-banana-2:RES_2K': 34,
        'nano-banana-2:RES_4K': 51,
        'nano-banana-pro:RES_1K': 51,
        'nano-banana-pro:RES_2K': 51,
        'nano-banana-pro:RES_4K': 68,
        'kling-2.6/motion-control:RES_720P': 17,
        'kling-2.6/motion-control:RES_1080P': 26,
        'gemini-3.1-flash-image-preview:RES_1K': 23,
        'gemini-3.1-flash-image-preview:RES_2K': 34,
        'gemini-3.1-flash-image-preview:RES_4K': 51,
        'gemini-3-pro-image-preview:RES_1K': 51,
        'gemini-3-pro-image-preview:RES_2K': 51,
        'gemini-3-pro-image-preview:RES_4K': 68,
        'veo-3.1-fast-generate-preview:RES_720P': 13,
        'veo-3.1-fast-generate-preview:RES_1080P': 13,
        'veo-3.1-fast-generate-preview:RES_4K': 40,
        'veo-3.1-generate-preview:RES_720P': 27,
        'veo-3.1-generate-preview:RES_1080P': 27,
        'veo-3.1-generate-preview:RES_4K': 53,
    };
    isGeraewModel(modelUsed) {
        if (!modelUsed)
            return false;
        return AdminService_1.GERAEW_MODEL_PREFIXES.some((prefix) => modelUsed.startsWith(prefix));
    }
    async getStats() {
        const [totalUsers, activeSubscriptions, revenueResult, totalGenerations, pendingCount, processingCount, completedCount, failedCount, modelGroups,] = await Promise.all([
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
            this.prisma.generation.groupBy({
                by: ['modelUsed'],
                _count: { _all: true },
            }),
        ]);
        let geraewCount = 0;
        let kieCount = 0;
        let nanoBanana2Count = 0;
        let nanoBananaProCount = 0;
        let klingCount = 0;
        for (const group of modelGroups) {
            const model = group.modelUsed;
            const count = group._count._all;
            if (this.isGeraewModel(model)) {
                geraewCount += count;
            }
            else {
                kieCount += count;
                if (model === 'nano-banana-2') {
                    nanoBanana2Count += count;
                }
                else if (model === 'nano-banana-pro') {
                    nanoBananaProCount += count;
                }
                else if (model?.startsWith('kling')) {
                    klingCount += count;
                }
            }
        }
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
            generationsByProvider: {
                geraew: geraewCount,
                kie: kieCount,
                kieBreakdown: {
                    nanoBanana2: nanoBanana2Count,
                    nanoBananaPro: nanoBananaProCount,
                    kling: klingCount,
                },
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
    async getProviderStats() {
        const [totalByProvider, completedByProvider, failedByProvider] = await Promise.all([
            this.prisma.generation.groupBy({
                by: ['modelUsed'],
                _count: { _all: true },
                _sum: { creditsConsumed: true },
            }),
            this.prisma.generation.groupBy({
                by: ['modelUsed'],
                where: { status: client_1.GenerationStatus.COMPLETED },
                _count: { _all: true },
            }),
            this.prisma.generation.groupBy({
                by: ['modelUsed'],
                where: { status: client_1.GenerationStatus.FAILED },
                _count: { _all: true },
            }),
        ]);
        const completedMap = new Map(completedByProvider.map((r) => [r.modelUsed, r._count._all]));
        const failedMap = new Map(failedByProvider.map((r) => [r.modelUsed, r._count._all]));
        const providers = totalByProvider.map((r) => ({
            provider: r.modelUsed ?? 'unknown',
            total: r._count._all,
            completed: completedMap.get(r.modelUsed) ?? 0,
            failed: failedMap.get(r.modelUsed) ?? 0,
            creditsConsumed: r._sum.creditsConsumed ?? 0,
        }));
        return { providers };
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
    async getFinancialStats(days) {
        const since = new Date();
        since.setDate(since.getDate() - days);
        const [mrrResult, dailyRevenue, revenueByPlan, boostSales, totalUsers, totalRevenueResult, apiCostRows,] = await Promise.all([
            this.prisma.$queryRaw `
        SELECT COALESCE(SUM(p.price_cents), 0)::int AS mrr_cents
        FROM subscriptions s
        JOIN plans p ON p.id = s.plan_id
        WHERE s.status = 'ACTIVE'
      `,
            this.prisma.$queryRaw `
        SELECT DATE_TRUNC('day', created_at)::date AS date,
               COALESCE(SUM(amount_cents), 0)::int AS revenue_cents
        FROM payments
        WHERE status = 'COMPLETED'
          AND created_at >= ${since}
        GROUP BY DATE_TRUNC('day', created_at)::date
        ORDER BY date ASC
      `,
            this.prisma.$queryRaw `
        SELECT pl.name AS plan_name,
               pl.slug AS plan_slug,
               COALESCE(SUM(pay.amount_cents), 0)::int AS revenue_cents,
               COUNT(pay.id)::int AS payment_count
        FROM payments pay
        JOIN subscriptions sub ON sub.id = pay.subscription_id
        JOIN plans pl ON pl.id = sub.plan_id
        WHERE pay.status = 'COMPLETED'
          AND pay.type = 'SUBSCRIPTION'
          AND pay.created_at >= ${since}
        GROUP BY pl.slug, pl.name
        ORDER BY revenue_cents DESC
      `,
            this.prisma.$queryRaw `
        SELECT cp.name,
               cp.credits,
               cp.price_cents,
               COUNT(pay.id)::int AS sold_count,
               COALESCE(SUM(pay.amount_cents), 0)::int AS total_revenue_cents
        FROM payments pay
        JOIN credit_packages cp ON cp.id = pay.credit_package_id
        WHERE pay.status = 'COMPLETED'
          AND pay.type = 'CREDIT_PURCHASE'
          AND pay.created_at >= ${since}
        GROUP BY cp.id, cp.name, cp.credits, cp.price_cents
        ORDER BY total_revenue_cents DESC
      `,
            this.prisma.user.count(),
            this.prisma.$queryRaw `
        SELECT COALESCE(SUM(amount_cents), 0)::int AS total
        FROM payments
        WHERE status = 'COMPLETED'
          AND created_at >= ${since}
      `,
            this.prisma.$queryRaw `
        SELECT model_used,
               resolution::text AS resolution,
               COUNT(*)::int AS gen_count
        FROM generations
        WHERE status = 'COMPLETED'
          AND created_at >= ${since}
        GROUP BY model_used, resolution
      `,
        ]);
        const mrrCents = mrrResult[0]?.mrr_cents ?? 0;
        const totalRevenueCents = totalRevenueResult[0]?.total ?? 0;
        let totalApiCostCents = 0;
        for (const row of apiCostRows) {
            const key = `${row.model_used}:${row.resolution}`;
            const unitCost = AdminService_1.API_COST_MAP[key] ?? 0;
            totalApiCostCents += unitCost * row.gen_count;
        }
        const arpuCents = totalUsers > 0 ? Math.round(totalRevenueCents / totalUsers) : 0;
        const marginPercent = totalRevenueCents > 0
            ? Math.round(((totalRevenueCents - totalApiCostCents) / totalRevenueCents) * 10000) / 100
            : 0;
        return {
            mrrCents,
            dailyRevenue: dailyRevenue.map((r) => ({
                date: String(r.date),
                revenueCents: r.revenue_cents,
            })),
            revenueByPlan: revenueByPlan.map((r) => ({
                planName: r.plan_name,
                planSlug: r.plan_slug,
                revenueCents: r.revenue_cents,
                paymentCount: r.payment_count,
            })),
            boostSales: boostSales.map((r) => ({
                name: r.name,
                credits: r.credits,
                priceCents: r.price_cents,
                soldCount: r.sold_count,
                totalRevenueCents: r.total_revenue_cents,
            })),
            arpuCents,
            totalRevenueCents,
            totalApiCostCents,
            marginPercent,
        };
    }
    async getUserStats(days) {
        const since = new Date();
        since.setDate(since.getDate() - days);
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - 7);
        const monthStart = new Date(todayStart);
        monthStart.setMonth(monthStart.getMonth() - 1);
        const [newUsersToday, newUsersWeek, newUsersMonth, dailyNewUsers, planDistribution, paidUsers, canceledRecently, topConsumers, inactiveResult, totalUsers,] = await Promise.all([
            this.prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
            this.prisma.user.count({ where: { createdAt: { gte: weekStart } } }),
            this.prisma.user.count({ where: { createdAt: { gte: monthStart } } }),
            this.prisma.$queryRaw `
        SELECT DATE_TRUNC('day', created_at)::date AS date,
               COUNT(*)::int AS count
        FROM users
        WHERE created_at >= ${since}
        GROUP BY DATE_TRUNC('day', created_at)::date
        ORDER BY date ASC
      `,
            this.prisma.$queryRaw `
        SELECT COALESCE(p.name, 'Free') AS plan_name,
               COALESCE(p.slug, 'free') AS plan_slug,
               COUNT(DISTINCT u.id)::int AS user_count
        FROM users u
        LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'ACTIVE'
        LEFT JOIN plans p ON p.id = s.plan_id
        GROUP BY p.name, p.slug
        ORDER BY user_count DESC
      `,
            this.prisma.$queryRaw `
        SELECT COUNT(DISTINCT s.user_id)::int AS count
        FROM subscriptions s
        JOIN plans p ON p.id = s.plan_id
        WHERE s.status = 'ACTIVE'
          AND p.slug != 'free'
      `,
            this.prisma.subscription.count({
                where: {
                    status: client_1.SubscriptionStatus.CANCELED,
                    updatedAt: { gte: since },
                },
            }),
            this.prisma.$queryRaw `
        SELECT g.user_id,
               u.email,
               u.name,
               COALESCE(SUM(g.credits_consumed), 0)::int AS total_credits
        FROM generations g
        JOIN users u ON u.id = g.user_id
        WHERE g.created_at >= ${since}
        GROUP BY g.user_id, u.email, u.name
        ORDER BY total_credits DESC
        LIMIT 10
      `,
            this.prisma.$queryRaw `
        SELECT COUNT(*)::int AS count
        FROM users u
        WHERE NOT EXISTS (
          SELECT 1 FROM generations g
          WHERE g.user_id = u.id
            AND g.created_at >= ${since}
        )
      `,
            this.prisma.user.count(),
        ]);
        const paidCount = paidUsers[0]?.count ?? 0;
        const inactiveCount = inactiveResult[0]?.count ?? 0;
        const conversionRate = totalUsers > 0 ? Math.round((paidCount / totalUsers) * 10000) / 100 : 0;
        const churnRate = paidCount > 0
            ? Math.round((canceledRecently / (paidCount + canceledRecently)) * 10000) / 100
            : 0;
        return {
            newUsersToday,
            newUsersWeek,
            newUsersMonth,
            dailyNewUsers: dailyNewUsers.map((r) => ({
                date: String(r.date),
                count: r.count,
            })),
            planDistribution: planDistribution.map((r) => ({
                planName: r.plan_name,
                planSlug: r.plan_slug,
                userCount: r.user_count,
            })),
            paidUsers: paidCount,
            canceledRecently,
            topConsumers: topConsumers.map((r) => ({
                userId: r.user_id,
                email: r.email,
                name: r.name,
                totalCredits: r.total_credits,
            })),
            inactiveUsers: inactiveCount,
            totalUsers,
            conversionRate,
            churnRate,
        };
    }
    async getUsageStats(days) {
        const since = new Date();
        since.setDate(since.getDate() - days);
        const tenMinutesAgo = new Date();
        tenMinutesAgo.setMinutes(tenMinutesAgo.getMinutes() - 10);
        const [dailyGenerations, byType, avgProcessingByModel, errorRateByModel, peakHours, stuckGenerations,] = await Promise.all([
            this.prisma.$queryRaw `
        SELECT DATE_TRUNC('day', created_at)::date AS date,
               COUNT(*)::int AS count
        FROM generations
        WHERE created_at >= ${since}
        GROUP BY DATE_TRUNC('day', created_at)::date
        ORDER BY date ASC
      `,
            this.prisma.generation.groupBy({
                by: ['type'],
                where: { createdAt: { gte: since } },
                _count: { _all: true },
            }),
            this.prisma.$queryRaw `
        SELECT model_used,
               COALESCE(AVG(processing_time_ms), 0)::int AS avg_ms,
               COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY processing_time_ms), 0)::int AS p95_ms,
               COUNT(*)::int AS count
        FROM generations
        WHERE status = 'COMPLETED'
          AND processing_time_ms IS NOT NULL
          AND created_at >= ${since}
        GROUP BY model_used
        ORDER BY count DESC
      `,
            this.prisma.$queryRaw `
        SELECT model_used,
               COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE status = 'FAILED')::int AS failed,
               CASE WHEN COUNT(*) > 0
                 THEN ROUND(COUNT(*) FILTER (WHERE status = 'FAILED')::numeric / COUNT(*)::numeric * 100, 2)::float
                 ELSE 0
               END AS error_rate
        FROM generations
        WHERE created_at >= ${since}
        GROUP BY model_used
        ORDER BY total DESC
      `,
            this.prisma.$queryRaw `
        SELECT EXTRACT(HOUR FROM created_at)::int AS hour,
               COUNT(*)::int AS count
        FROM generations
        WHERE created_at >= ${since}
        GROUP BY EXTRACT(HOUR FROM created_at)
        ORDER BY hour ASC
      `,
            this.prisma.generation.findMany({
                where: {
                    status: client_1.GenerationStatus.PROCESSING,
                    createdAt: { lt: tenMinutesAgo },
                },
                select: {
                    id: true,
                    userId: true,
                    type: true,
                    modelUsed: true,
                    createdAt: true,
                    processingStartedAt: true,
                },
                orderBy: { createdAt: 'asc' },
            }),
        ]);
        return {
            dailyGenerations: dailyGenerations.map((r) => ({
                date: String(r.date),
                count: r.count,
            })),
            byType: byType.map((r) => ({
                type: r.type,
                count: r._count._all,
            })),
            avgProcessingByModel: avgProcessingByModel.map((r) => ({
                modelUsed: r.model_used,
                avgMs: r.avg_ms,
                p95Ms: r.p95_ms,
                count: r.count,
            })),
            errorRateByModel: errorRateByModel.map((r) => ({
                modelUsed: r.model_used,
                total: r.total,
                failed: r.failed,
                errorRate: r.error_rate,
            })),
            peakHours: peakHours.map((r) => ({
                hour: r.hour,
                count: r.count,
            })),
            stuckGenerations: stuckGenerations.map((g) => ({
                id: g.id,
                userId: g.userId,
                type: g.type,
                modelUsed: g.modelUsed,
                createdAt: g.createdAt,
                processingStartedAt: g.processingStartedAt,
            })),
        };
    }
    async getCreditStats(days) {
        const since = new Date();
        since.setDate(since.getDate() - days);
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - 7);
        const monthStart = new Date(todayStart);
        monthStart.setMonth(monthStart.getMonth() - 1);
        const [consumedToday, consumedWeek, consumedMonth, dailyConsumption, allocationVsUsage, nearLimitUsers, refunds,] = await Promise.all([
            this.prisma.creditTransaction.aggregate({
                _sum: { amount: true },
                where: {
                    type: client_1.CreditTransactionType.GENERATION_DEBIT,
                    createdAt: { gte: todayStart },
                },
            }),
            this.prisma.creditTransaction.aggregate({
                _sum: { amount: true },
                where: {
                    type: client_1.CreditTransactionType.GENERATION_DEBIT,
                    createdAt: { gte: weekStart },
                },
            }),
            this.prisma.creditTransaction.aggregate({
                _sum: { amount: true },
                where: {
                    type: client_1.CreditTransactionType.GENERATION_DEBIT,
                    createdAt: { gte: monthStart },
                },
            }),
            this.prisma.$queryRaw `
        SELECT DATE_TRUNC('day', created_at)::date AS date,
               COALESCE(SUM(ABS(amount)), 0)::int AS consumed
        FROM credit_transactions
        WHERE type = 'GENERATION_DEBIT'
          AND created_at >= ${since}
        GROUP BY DATE_TRUNC('day', created_at)::date
        ORDER BY date ASC
      `,
            this.prisma.$queryRaw `
        SELECT COALESCE(SUM(cb.plan_credits_used), 0)::int AS total_used,
               COALESCE(SUM(p.credits_per_month), 0)::int AS total_allocated
        FROM credit_balances cb
        JOIN users u ON u.id = cb.user_id
        JOIN subscriptions s ON s.user_id = u.id AND s.status = 'ACTIVE'
        JOIN plans p ON p.id = s.plan_id
      `,
            this.prisma.$queryRaw `
        SELECT cb.user_id,
               u.email,
               u.name,
               cb.plan_credits_remaining,
               p.credits_per_month,
               CASE WHEN p.credits_per_month > 0
                 THEN ROUND((1 - cb.plan_credits_remaining::numeric / p.credits_per_month::numeric) * 100, 1)::float
                 ELSE 0
               END AS usage_percent
        FROM credit_balances cb
        JOIN users u ON u.id = cb.user_id
        JOIN subscriptions s ON s.user_id = u.id AND s.status = 'ACTIVE'
        JOIN plans p ON p.id = s.plan_id
        WHERE p.credits_per_month > 0
          AND cb.plan_credits_remaining::numeric / p.credits_per_month::numeric < 0.1
        ORDER BY usage_percent DESC
      `,
            this.prisma.creditTransaction.aggregate({
                _sum: { amount: true },
                _count: { _all: true },
                where: {
                    type: client_1.CreditTransactionType.GENERATION_REFUND,
                    createdAt: { gte: since },
                },
            }),
        ]);
        const allocUsage = allocationVsUsage[0] ?? { total_used: 0, total_allocated: 0 };
        return {
            consumedToday: Math.abs(consumedToday._sum.amount ?? 0),
            consumedWeek: Math.abs(consumedWeek._sum.amount ?? 0),
            consumedMonth: Math.abs(consumedMonth._sum.amount ?? 0),
            dailyConsumption: dailyConsumption.map((r) => ({
                date: String(r.date),
                consumed: r.consumed,
            })),
            allocationVsUsage: {
                totalAllocated: allocUsage.total_allocated,
                totalUsed: allocUsage.total_used,
                usagePercent: allocUsage.total_allocated > 0
                    ? Math.round((allocUsage.total_used / allocUsage.total_allocated) * 10000) / 100
                    : 0,
            },
            nearLimitUsers: nearLimitUsers.map((r) => ({
                userId: r.user_id,
                email: r.email,
                name: r.name,
                planCreditsRemaining: r.plan_credits_remaining,
                creditsPerMonth: r.credits_per_month,
                usagePercent: r.usage_percent,
            })),
            refunds: {
                totalAmount: refunds._sum.amount ?? 0,
                count: refunds._count._all,
            },
        };
    }
    async getHealthStats() {
        const tenMinutesAgo = new Date();
        tenMinutesAgo.setMinutes(tenMinutesAgo.getMinutes() - 10);
        const oneHourAgo = new Date();
        oneHourAgo.setHours(oneHourAgo.getHours() - 1);
        const twentyFourHoursAgo = new Date();
        twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
        const [processingCount, pendingCount, stuckCount, recentFailuresByModel, failingPayments, recentErrors,] = await Promise.all([
            this.prisma.generation.count({
                where: { status: client_1.GenerationStatus.PROCESSING },
            }),
            this.prisma.generation.count({
                where: { status: client_1.GenerationStatus.PENDING },
            }),
            this.prisma.generation.count({
                where: {
                    status: client_1.GenerationStatus.PROCESSING,
                    createdAt: { lt: tenMinutesAgo },
                },
            }),
            this.prisma.$queryRaw `
        SELECT model_used,
               COUNT(*)::int AS failed_count,
               ARRAY_AGG(DISTINCT error_code) FILTER (WHERE error_code IS NOT NULL) AS error_codes
        FROM generations
        WHERE status = 'FAILED'
          AND created_at >= ${oneHourAgo}
        GROUP BY model_used
        ORDER BY failed_count DESC
      `,
            this.prisma.payment.count({
                where: {
                    status: 'FAILED',
                    createdAt: { gte: twentyFourHoursAgo },
                },
            }),
            this.prisma.generation.findMany({
                where: { status: client_1.GenerationStatus.FAILED },
                select: {
                    id: true,
                    userId: true,
                    type: true,
                    modelUsed: true,
                    errorMessage: true,
                    errorCode: true,
                    createdAt: true,
                },
                orderBy: { createdAt: 'desc' },
                take: 10,
            }),
        ]);
        const alerts = [];
        if (stuckCount > 0) {
            alerts.push({
                level: stuckCount >= 5 ? 'critical' : 'warning',
                message: `${stuckCount} generation(s) stuck in PROCESSING for more than 10 minutes`,
            });
        }
        if (pendingCount > 50) {
            alerts.push({
                level: pendingCount >= 100 ? 'critical' : 'warning',
                message: `${pendingCount} generation(s) pending in queue`,
            });
        }
        if (failingPayments > 5) {
            alerts.push({
                level: failingPayments >= 20 ? 'critical' : 'warning',
                message: `${failingPayments} failed payment(s) in the last 24 hours`,
            });
        }
        for (const failure of recentFailuresByModel) {
            if (failure.failed_count >= 10) {
                alerts.push({
                    level: failure.failed_count >= 30 ? 'critical' : 'warning',
                    message: `${failure.failed_count} failure(s) for model "${failure.model_used}" in the last hour`,
                });
            }
        }
        return {
            queue: {
                processing: processingCount,
                pending: pendingCount,
            },
            stuckCount,
            recentFailuresByModel: recentFailuresByModel.map((r) => ({
                modelUsed: r.model_used,
                failedCount: r.failed_count,
                errorCodes: r.error_codes ?? [],
            })),
            failingPayments,
            recentErrors: recentErrors.map((e) => ({
                id: e.id,
                userId: e.userId,
                type: e.type,
                modelUsed: e.modelUsed,
                errorMessage: e.errorMessage,
                errorCode: e.errorCode,
                createdAt: e.createdAt,
            })),
            alerts,
        };
    }
};
exports.AdminService = AdminService;
exports.AdminService = AdminService = AdminService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AdminService);
//# sourceMappingURL=admin.service.js.map