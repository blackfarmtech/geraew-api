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
var PaymentsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
let PaymentsService = PaymentsService_1 = class PaymentsService {
    prisma;
    logger = new common_1.Logger(PaymentsService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createPayment(userId, type, amountCents, provider, metadata) {
        return this.prisma.payment.create({
            data: {
                userId,
                type,
                amountCents,
                provider,
                metadata: metadata ?? client_1.Prisma.JsonNull,
            },
        });
    }
    async updatePaymentStatus(id, status, externalPaymentId) {
        return this.prisma.payment.update({
            where: { id },
            data: {
                status,
                ...(externalPaymentId && { externalPaymentId }),
            },
        });
    }
    async findByExternalPaymentId(externalPaymentId) {
        return this.prisma.payment.findFirst({
            where: { externalPaymentId },
        });
    }
    async processSubscriptionPayment(userId, planSlug, stripeSubscriptionId, amountCents, externalPaymentId) {
        const plan = await this.prisma.plan.findUnique({
            where: { slug: planSlug },
        });
        if (!plan) {
            throw new common_1.NotFoundException(`Plano "${planSlug}" não encontrado`);
        }
        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setMonth(periodEnd.getMonth() + 1);
        await this.prisma.$transaction(async (tx) => {
            await tx.subscription.updateMany({
                where: {
                    userId,
                    status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] },
                },
                data: {
                    status: 'CANCELED',
                    cancelAtPeriodEnd: false,
                },
            });
            const subscription = await tx.subscription.create({
                data: {
                    userId,
                    planId: plan.id,
                    status: 'ACTIVE',
                    currentPeriodStart: now,
                    currentPeriodEnd: periodEnd,
                    paymentProvider: 'stripe',
                    externalSubscriptionId: stripeSubscriptionId,
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
            const payment = await tx.payment.create({
                data: {
                    userId,
                    type: 'SUBSCRIPTION',
                    amountCents,
                    currency: 'BRL',
                    status: 'COMPLETED',
                    provider: 'stripe',
                    externalPaymentId,
                    subscriptionId: subscription.id,
                },
            });
            await tx.creditTransaction.create({
                data: {
                    userId,
                    type: 'SUBSCRIPTION_RENEWAL',
                    amount: plan.creditsPerMonth,
                    source: 'plan',
                    description: `Assinatura criada — plano ${plan.name}`,
                    paymentId: payment.id,
                },
            });
        });
        this.logger.log(`Processed subscription payment for user ${userId}, plan ${planSlug}`);
    }
    async processCreditPurchase(userId, packageId, amountCents, externalPaymentId) {
        const creditPackage = await this.prisma.creditPackage.findUnique({
            where: { id: packageId },
        });
        if (!creditPackage) {
            throw new common_1.NotFoundException(`Pacote "${packageId}" não encontrado`);
        }
        await this.prisma.$transaction(async (tx) => {
            await tx.creditBalance.upsert({
                where: { userId },
                create: {
                    userId,
                    planCreditsRemaining: 0,
                    bonusCreditsRemaining: creditPackage.credits,
                    planCreditsUsed: 0,
                },
                update: {
                    bonusCreditsRemaining: {
                        increment: creditPackage.credits,
                    },
                },
            });
            const payment = await tx.payment.create({
                data: {
                    userId,
                    type: 'CREDIT_PURCHASE',
                    amountCents,
                    currency: 'BRL',
                    status: 'COMPLETED',
                    provider: 'stripe',
                    externalPaymentId,
                    creditPackageId: packageId,
                },
            });
            await tx.creditTransaction.create({
                data: {
                    userId,
                    type: 'PURCHASE',
                    amount: creditPackage.credits,
                    source: 'bonus',
                    description: `Compra avulsa — ${creditPackage.name} (${creditPackage.credits} créditos)`,
                    paymentId: payment.id,
                },
            });
        });
        this.logger.log(`Processed credit purchase for user ${userId}, package ${creditPackage.name}`);
    }
    async handleSubscriptionRenewal(stripeSubscriptionId, periodStart, periodEnd, amountCents, externalPaymentId) {
        const subscription = await this.prisma.subscription.findFirst({
            where: { externalSubscriptionId: stripeSubscriptionId },
            include: { plan: true },
        });
        if (!subscription) {
            this.logger.warn(`Subscription not found for Stripe ID ${stripeSubscriptionId}`);
            return;
        }
        const hasScheduledPlan = !!subscription.scheduledPlanId;
        let activePlan = subscription.plan;
        if (hasScheduledPlan) {
            const scheduled = await this.prisma.plan.findUnique({
                where: { id: subscription.scheduledPlanId },
            });
            if (scheduled) {
                activePlan = scheduled;
            }
        }
        await this.prisma.$transaction(async (tx) => {
            await tx.subscription.update({
                where: { id: subscription.id },
                data: {
                    status: 'ACTIVE',
                    currentPeriodStart: periodStart,
                    currentPeriodEnd: periodEnd,
                    paymentRetryCount: 0,
                    ...(hasScheduledPlan && {
                        planId: activePlan.id,
                        scheduledPlanId: null,
                    }),
                },
            });
            await tx.creditBalance.upsert({
                where: { userId: subscription.userId },
                create: {
                    userId: subscription.userId,
                    planCreditsRemaining: activePlan.creditsPerMonth,
                    bonusCreditsRemaining: 0,
                    planCreditsUsed: 0,
                    periodStart,
                    periodEnd,
                },
                update: {
                    planCreditsRemaining: activePlan.creditsPerMonth,
                    planCreditsUsed: 0,
                    periodStart,
                    periodEnd,
                },
            });
            const payment = await tx.payment.create({
                data: {
                    userId: subscription.userId,
                    type: 'SUBSCRIPTION',
                    amountCents,
                    currency: 'BRL',
                    status: 'COMPLETED',
                    provider: 'stripe',
                    externalPaymentId,
                    subscriptionId: subscription.id,
                },
            });
            await tx.creditTransaction.create({
                data: {
                    userId: subscription.userId,
                    type: 'SUBSCRIPTION_RENEWAL',
                    amount: activePlan.creditsPerMonth,
                    source: 'plan',
                    description: hasScheduledPlan
                        ? `Downgrade aplicado — plano ${activePlan.name}`
                        : `Renovação mensal — plano ${activePlan.name}`,
                    paymentId: payment.id,
                },
            });
        });
        this.logger.log(`Processed subscription renewal for user ${subscription.userId}${hasScheduledPlan ? ` (downgrade to ${activePlan.slug})` : ''}`);
    }
    async handlePaymentFailed(stripeSubscriptionId, amountCents, externalPaymentId) {
        const subscription = await this.prisma.subscription.findFirst({
            where: { externalSubscriptionId: stripeSubscriptionId },
        });
        if (!subscription) {
            this.logger.warn(`Subscription not found for Stripe ID ${stripeSubscriptionId}`);
            return;
        }
        await this.prisma.$transaction(async (tx) => {
            await tx.subscription.update({
                where: { id: subscription.id },
                data: {
                    status: 'PAST_DUE',
                    paymentRetryCount: { increment: 1 },
                },
            });
            await tx.payment.create({
                data: {
                    userId: subscription.userId,
                    type: 'SUBSCRIPTION',
                    amountCents,
                    currency: 'BRL',
                    status: 'FAILED',
                    provider: 'stripe',
                    externalPaymentId,
                    subscriptionId: subscription.id,
                },
            });
        });
        this.logger.warn(`Payment failed for subscription ${subscription.id}, retry count: ${subscription.paymentRetryCount + 1}`);
    }
    async handleRefund(paymentIntentId, invoiceId, amountRefundedCents) {
        const lookup = [paymentIntentId, invoiceId].filter(Boolean);
        const payment = await this.prisma.payment.findFirst({
            where: { externalPaymentId: { in: lookup } },
            include: { creditPackage: true, subscription: { include: { plan: true } } },
        });
        if (!payment) {
            this.logger.warn(`Payment not found for refund: paymentIntentId=${paymentIntentId}, invoiceId=${invoiceId}`);
            return;
        }
        if (payment.status === 'REFUNDED') {
            this.logger.log(`Payment ${payment.id} already refunded, skipping`);
            return;
        }
        await this.prisma.$transaction(async (tx) => {
            await tx.payment.update({
                where: { id: payment.id },
                data: { status: 'REFUNDED' },
            });
            if (payment.type === 'SUBSCRIPTION' && payment.subscriptionId) {
                const freePlan = await tx.plan.findUnique({ where: { slug: 'free' } });
                await tx.subscription.update({
                    where: { id: payment.subscriptionId },
                    data: {
                        status: 'CANCELED',
                        cancelAtPeriodEnd: false,
                        ...(freePlan && { planId: freePlan.id }),
                    },
                });
                await tx.creditBalance.updateMany({
                    where: { userId: payment.userId },
                    data: { planCreditsRemaining: 0, planCreditsUsed: 0 },
                });
                await tx.creditTransaction.create({
                    data: {
                        userId: payment.userId,
                        type: 'ADMIN_ADJUSTMENT',
                        amount: -(payment.subscription?.plan?.creditsPerMonth ?? 0),
                        source: 'plan',
                        description: `Reembolso de assinatura — R$ ${(amountRefundedCents / 100).toFixed(2)}`,
                        paymentId: payment.id,
                    },
                });
            }
            else if (payment.type === 'CREDIT_PURCHASE' && payment.creditPackage) {
                const creditsToRemove = payment.creditPackage.credits;
                const balance = await tx.creditBalance.findUnique({ where: { userId: payment.userId } });
                const safeDeduction = Math.min(creditsToRemove, balance?.bonusCreditsRemaining ?? 0);
                await tx.creditBalance.updateMany({
                    where: { userId: payment.userId },
                    data: { bonusCreditsRemaining: { decrement: safeDeduction } },
                });
                await tx.creditTransaction.create({
                    data: {
                        userId: payment.userId,
                        type: 'ADMIN_ADJUSTMENT',
                        amount: -safeDeduction,
                        source: 'bonus',
                        description: `Reembolso de créditos — ${creditsToRemove} créditos — R$ ${(amountRefundedCents / 100).toFixed(2)}`,
                        paymentId: payment.id,
                    },
                });
            }
        });
        this.logger.log(`Refund processed for payment ${payment.id}, user ${payment.userId}`);
    }
    async handleSubscriptionDeleted(stripeSubscriptionId) {
        const subscription = await this.prisma.subscription.findFirst({
            where: { externalSubscriptionId: stripeSubscriptionId },
        });
        if (!subscription) {
            this.logger.warn(`Subscription not found for Stripe ID ${stripeSubscriptionId}`);
            return;
        }
        await this.prisma.$transaction(async (tx) => {
            await tx.subscription.update({
                where: { id: subscription.id },
                data: {
                    status: 'CANCELED',
                    cancelAtPeriodEnd: false,
                },
            });
            const newerActiveSub = await tx.subscription.findFirst({
                where: {
                    userId: subscription.userId,
                    status: { in: ['ACTIVE', 'TRIALING'] },
                    id: { not: subscription.id },
                },
            });
            if (!newerActiveSub) {
                const balance = await tx.creditBalance.findUnique({
                    where: { userId: subscription.userId },
                });
                if (balance) {
                    await tx.creditBalance.update({
                        where: { userId: subscription.userId },
                        data: {
                            planCreditsRemaining: 0,
                            planCreditsUsed: 0,
                        },
                    });
                }
            }
        });
        this.logger.log(`Subscription ${subscription.id} deleted for user ${subscription.userId}`);
    }
};
exports.PaymentsService = PaymentsService;
exports.PaymentsService = PaymentsService = PaymentsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PaymentsService);
//# sourceMappingURL=payments.service.js.map