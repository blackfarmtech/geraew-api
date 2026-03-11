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
var SubscriptionRenewalService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionRenewalService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
let SubscriptionRenewalService = SubscriptionRenewalService_1 = class SubscriptionRenewalService {
    prisma;
    logger = new common_1.Logger(SubscriptionRenewalService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async handleSubscriptionRenewal() {
        try {
            const now = new Date();
            const expiredSubscriptions = await this.prisma.subscription.findMany({
                where: {
                    status: client_1.SubscriptionStatus.ACTIVE,
                    currentPeriodEnd: { lte: now },
                    cancelAtPeriodEnd: false,
                },
                include: { plan: true },
            });
            this.logger.log(`Found ${expiredSubscriptions.length} subscriptions to renew`);
            for (const subscription of expiredSubscriptions) {
                try {
                    await this.renewSubscription(subscription);
                }
                catch (error) {
                    this.logger.error(`Failed to renew subscription ${subscription.id}: ${error.message}`);
                }
            }
            const cancelingSubscriptions = await this.prisma.subscription.findMany({
                where: {
                    status: client_1.SubscriptionStatus.ACTIVE,
                    currentPeriodEnd: { lte: now },
                    cancelAtPeriodEnd: true,
                },
            });
            for (const subscription of cancelingSubscriptions) {
                try {
                    await this.prisma.subscription.update({
                        where: { id: subscription.id },
                        data: { status: client_1.SubscriptionStatus.CANCELED },
                    });
                    this.logger.log(`Canceled subscription ${subscription.id} at period end`);
                }
                catch (error) {
                    this.logger.error(`Failed to cancel subscription ${subscription.id}: ${error.message}`);
                }
            }
        }
        catch (error) {
            this.logger.error(`Subscription renewal cron failed: ${error.message}`, error.stack);
        }
    }
    async renewSubscription(subscription) {
        const newPeriodStart = subscription.currentPeriodEnd;
        const newPeriodEnd = new Date(newPeriodStart);
        newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
        await this.prisma.$transaction(async (tx) => {
            await tx.subscription.update({
                where: { id: subscription.id },
                data: {
                    currentPeriodStart: newPeriodStart,
                    currentPeriodEnd: newPeriodEnd,
                },
            });
            await tx.creditBalance.upsert({
                where: { userId: subscription.userId },
                create: {
                    userId: subscription.userId,
                    planCreditsRemaining: subscription.plan.creditsPerMonth,
                    bonusCreditsRemaining: 0,
                    planCreditsUsed: 0,
                    periodStart: newPeriodStart,
                    periodEnd: newPeriodEnd,
                },
                update: {
                    planCreditsRemaining: subscription.plan.creditsPerMonth,
                    planCreditsUsed: 0,
                    periodStart: newPeriodStart,
                    periodEnd: newPeriodEnd,
                },
            });
            await tx.creditTransaction.create({
                data: {
                    userId: subscription.userId,
                    type: client_1.CreditTransactionType.SUBSCRIPTION_RENEWAL,
                    amount: subscription.plan.creditsPerMonth,
                    source: 'plan',
                    description: `Renovação do plano ${subscription.plan.name} — ${subscription.plan.creditsPerMonth} créditos`,
                },
            });
        });
        this.logger.log(`Renewed subscription ${subscription.id} for user ${subscription.userId}`);
    }
};
exports.SubscriptionRenewalService = SubscriptionRenewalService;
__decorate([
    (0, schedule_1.Cron)('0 * * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SubscriptionRenewalService.prototype, "handleSubscriptionRenewal", null);
exports.SubscriptionRenewalService = SubscriptionRenewalService = SubscriptionRenewalService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SubscriptionRenewalService);
//# sourceMappingURL=subscription-renewal.service.js.map