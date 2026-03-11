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
var PaymentRetryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentRetryService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
const MAX_RETRY_COUNT = 3;
let PaymentRetryService = PaymentRetryService_1 = class PaymentRetryService {
    prisma;
    logger = new common_1.Logger(PaymentRetryService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async handlePaymentRetry() {
        try {
            const pastDueSubscriptions = await this.prisma.subscription.findMany({
                where: {
                    status: client_1.SubscriptionStatus.PAST_DUE,
                },
                include: { plan: true, user: true },
            });
            this.logger.log(`Found ${pastDueSubscriptions.length} past-due subscriptions to process`);
            for (const subscription of pastDueSubscriptions) {
                try {
                    if (subscription.paymentRetryCount >= MAX_RETRY_COUNT) {
                        await this.downgradeToFree(subscription);
                    }
                    else {
                        await this.retryPayment(subscription);
                    }
                }
                catch (error) {
                    this.logger.error(`Failed to process past-due subscription ${subscription.id}: ${error.message}`);
                }
            }
        }
        catch (error) {
            this.logger.error(`Payment retry cron failed: ${error.message}`, error.stack);
        }
    }
    async retryPayment(subscription) {
        await this.prisma.subscription.update({
            where: { id: subscription.id },
            data: {
                paymentRetryCount: subscription.paymentRetryCount + 1,
            },
        });
        this.logger.log(`Incremented retry count for subscription ${subscription.id} (retry #${subscription.paymentRetryCount + 1})`);
    }
    async downgradeToFree(subscription) {
        const freePlan = await this.prisma.plan.findUnique({
            where: { slug: 'free' },
        });
        if (!freePlan) {
            this.logger.error('Free plan not found in database, cannot downgrade');
            return;
        }
        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setMonth(periodEnd.getMonth() + 1);
        await this.prisma.$transaction(async (tx) => {
            await tx.subscription.update({
                where: { id: subscription.id },
                data: { status: client_1.SubscriptionStatus.CANCELED },
            });
            await tx.subscription.create({
                data: {
                    userId: subscription.userId,
                    planId: freePlan.id,
                    status: client_1.SubscriptionStatus.ACTIVE,
                    currentPeriodStart: now,
                    currentPeriodEnd: periodEnd,
                },
            });
            await tx.creditBalance.upsert({
                where: { userId: subscription.userId },
                create: {
                    userId: subscription.userId,
                    planCreditsRemaining: freePlan.creditsPerMonth,
                    bonusCreditsRemaining: 0,
                    planCreditsUsed: 0,
                    periodStart: now,
                    periodEnd: periodEnd,
                },
                update: {
                    planCreditsRemaining: freePlan.creditsPerMonth,
                    planCreditsUsed: 0,
                    periodStart: now,
                    periodEnd: periodEnd,
                },
            });
        });
        this.logger.warn(`Downgraded subscription ${subscription.id} for user ${subscription.userId} to Free plan after ${MAX_RETRY_COUNT} failed retries`);
    }
};
exports.PaymentRetryService = PaymentRetryService;
__decorate([
    (0, schedule_1.Cron)('0 */6 * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PaymentRetryService.prototype, "handlePaymentRetry", null);
exports.PaymentRetryService = PaymentRetryService = PaymentRetryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PaymentRetryService);
//# sourceMappingURL=payment-retry.service.js.map