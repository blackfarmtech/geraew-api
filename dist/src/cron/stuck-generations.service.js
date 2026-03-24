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
var StuckGenerationsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StuckGenerationsService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
const STUCK_THRESHOLD_MINUTES = 25;
let StuckGenerationsService = StuckGenerationsService_1 = class StuckGenerationsService {
    prisma;
    logger = new common_1.Logger(StuckGenerationsService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async handleStuckGenerations() {
        try {
            const threshold = new Date();
            threshold.setMinutes(threshold.getMinutes() - STUCK_THRESHOLD_MINUTES);
            const stuckGenerations = await this.prisma.generation.findMany({
                where: {
                    status: client_1.GenerationStatus.PROCESSING,
                    createdAt: { lt: threshold },
                },
            });
            if (stuckGenerations.length === 0) {
                return;
            }
            this.logger.log(`Found ${stuckGenerations.length} stuck generations to clean up`);
            for (const generation of stuckGenerations) {
                try {
                    await this.failAndRefund(generation);
                }
                catch (error) {
                    this.logger.error(`Failed to clean up stuck generation ${generation.id}: ${error.message}`);
                }
            }
        }
        catch (error) {
            this.logger.error(`Stuck generations cron failed: ${error.message}`, error.stack);
        }
    }
    async failAndRefund(generation) {
        await this.prisma.$transaction(async (tx) => {
            await tx.generation.update({
                where: { id: generation.id },
                data: {
                    status: client_1.GenerationStatus.FAILED,
                    errorMessage: 'Geração expirou por timeout',
                    errorCode: 'GENERATION_TIMEOUT',
                },
            });
            if (generation.creditsConsumed <= 0) {
                return;
            }
            const debitTransactions = await tx.creditTransaction.findMany({
                where: {
                    generationId: generation.id,
                    type: client_1.CreditTransactionType.GENERATION_DEBIT,
                },
                orderBy: { createdAt: 'asc' },
            });
            let planRefund = 0;
            let bonusRefund = 0;
            for (const debit of debitTransactions) {
                if (debit.source === 'plan') {
                    planRefund += Math.abs(debit.amount);
                }
                else {
                    bonusRefund += Math.abs(debit.amount);
                }
            }
            if (debitTransactions.length === 0) {
                bonusRefund = generation.creditsConsumed;
            }
            const balance = await tx.creditBalance.findUnique({
                where: { userId: generation.userId },
            });
            if (balance) {
                await tx.creditBalance.update({
                    where: { userId: generation.userId },
                    data: {
                        planCreditsRemaining: balance.planCreditsRemaining + planRefund,
                        bonusCreditsRemaining: balance.bonusCreditsRemaining + bonusRefund,
                        planCreditsUsed: balance.planCreditsUsed - planRefund,
                    },
                });
            }
            if (planRefund > 0) {
                await tx.creditTransaction.create({
                    data: {
                        userId: generation.userId,
                        type: client_1.CreditTransactionType.GENERATION_REFUND,
                        amount: planRefund,
                        source: 'plan',
                        description: `Estorno de ${planRefund} créditos do plano (timeout)`,
                        generationId: generation.id,
                    },
                });
            }
            if (bonusRefund > 0) {
                await tx.creditTransaction.create({
                    data: {
                        userId: generation.userId,
                        type: client_1.CreditTransactionType.GENERATION_REFUND,
                        amount: bonusRefund,
                        source: 'bonus',
                        description: `Estorno de ${bonusRefund} créditos bônus (timeout)`,
                        generationId: generation.id,
                    },
                });
            }
        });
        this.logger.warn(`Marked generation ${generation.id} as failed (timeout) and refunded ${generation.creditsConsumed} credits`);
    }
};
exports.StuckGenerationsService = StuckGenerationsService;
__decorate([
    (0, schedule_1.Cron)('*/15 * * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], StuckGenerationsService.prototype, "handleStuckGenerations", null);
exports.StuckGenerationsService = StuckGenerationsService = StuckGenerationsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], StuckGenerationsService);
//# sourceMappingURL=stuck-generations.service.js.map