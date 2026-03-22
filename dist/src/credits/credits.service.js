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
exports.CreditsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const plans_service_1 = require("../plans/plans.service");
const client_1 = require("@prisma/client");
const paginated_response_dto_1 = require("../common/dto/paginated-response.dto");
let CreditsService = class CreditsService {
    prisma;
    plansService;
    constructor(prisma, plansService) {
        this.prisma = prisma;
        this.plansService = plansService;
    }
    async getBalance(userId) {
        const balance = await this.prisma.creditBalance.findUnique({
            where: { userId },
        });
        if (!balance) {
            return {
                planCreditsRemaining: 0,
                bonusCreditsRemaining: 0,
                totalCreditsAvailable: 0,
                planCreditsUsed: 0,
                periodStart: null,
                periodEnd: null,
            };
        }
        return {
            planCreditsRemaining: balance.planCreditsRemaining,
            bonusCreditsRemaining: balance.bonusCreditsRemaining,
            totalCreditsAvailable: balance.planCreditsRemaining + balance.bonusCreditsRemaining,
            planCreditsUsed: balance.planCreditsUsed,
            periodStart: balance.periodStart,
            periodEnd: balance.periodEnd,
        };
    }
    async getTransactions(userId, pagination) {
        const [transactions, total] = await Promise.all([
            this.prisma.creditTransaction.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                skip: pagination.skip,
                take: pagination.limit,
            }),
            this.prisma.creditTransaction.count({
                where: { userId },
            }),
        ]);
        const data = transactions.map((tx) => ({
            id: tx.id,
            type: tx.type,
            amount: tx.amount,
            source: tx.source,
            description: tx.description,
            generationId: tx.generationId,
            paymentId: tx.paymentId,
            createdAt: tx.createdAt,
        }));
        return new paginated_response_dto_1.PaginatedResponseDto(data, total, pagination.page, pagination.limit);
    }
    async getPackages() {
        return this.plansService.findAllPackages();
    }
    async estimateCost(userId, type, resolution, durationSeconds, hasAudio = false, sampleCount = 1, modelVariant) {
        const creditsRequired = await this.plansService.calculateGenerationCost(type, resolution, durationSeconds, hasAudio, sampleCount, modelVariant);
        const balance = await this.getBalance(userId);
        return {
            creditsRequired,
            hasSufficientBalance: balance.totalCreditsAvailable >= creditsRequired,
        };
    }
    async debit(userId, amount, type, generationId, description) {
        await this.prisma.$transaction(async (tx) => {
            const balance = await tx.creditBalance.findUnique({
                where: { userId },
            });
            if (!balance) {
                throw new common_1.NotFoundException('Saldo de créditos não encontrado');
            }
            const totalAvailable = balance.planCreditsRemaining + balance.bonusCreditsRemaining;
            if (totalAvailable < amount) {
                throw new common_1.BadRequestException({
                    code: 'INSUFFICIENT_CREDITS',
                    message: `Créditos insuficientes. Necessário: ${amount}, disponível: ${totalAvailable}.`,
                    statusCode: 402,
                });
            }
            let remainingDebit = amount;
            let planDebit = 0;
            let bonusDebit = 0;
            if (balance.planCreditsRemaining >= remainingDebit) {
                planDebit = remainingDebit;
                remainingDebit = 0;
            }
            else {
                planDebit = balance.planCreditsRemaining;
                remainingDebit -= planDebit;
                bonusDebit = remainingDebit;
            }
            await tx.creditBalance.update({
                where: { userId },
                data: {
                    planCreditsRemaining: balance.planCreditsRemaining - planDebit,
                    bonusCreditsRemaining: balance.bonusCreditsRemaining - bonusDebit,
                    planCreditsUsed: balance.planCreditsUsed + planDebit,
                },
            });
            if (planDebit > 0) {
                await tx.creditTransaction.create({
                    data: {
                        userId,
                        type,
                        amount: -planDebit,
                        source: 'plan',
                        description: description || `Débito de ${planDebit} créditos do plano`,
                        generationId,
                    },
                });
            }
            if (bonusDebit > 0) {
                await tx.creditTransaction.create({
                    data: {
                        userId,
                        type,
                        amount: -bonusDebit,
                        source: 'bonus',
                        description: description || `Débito de ${bonusDebit} créditos bônus`,
                        generationId,
                    },
                });
            }
        });
    }
    async refund(userId, amount, generationId) {
        await this.prisma.$transaction(async (tx) => {
            const debitTransactions = await tx.creditTransaction.findMany({
                where: {
                    generationId,
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
                bonusRefund = amount;
            }
            const balance = await tx.creditBalance.findUnique({
                where: { userId },
            });
            if (!balance) {
                throw new common_1.NotFoundException('Saldo de créditos não encontrado');
            }
            await tx.creditBalance.update({
                where: { userId },
                data: {
                    planCreditsRemaining: balance.planCreditsRemaining + planRefund,
                    bonusCreditsRemaining: balance.bonusCreditsRemaining + bonusRefund,
                    planCreditsUsed: balance.planCreditsUsed - planRefund,
                },
            });
            if (planRefund > 0) {
                await tx.creditTransaction.create({
                    data: {
                        userId,
                        type: client_1.CreditTransactionType.GENERATION_REFUND,
                        amount: planRefund,
                        source: 'plan',
                        description: `Estorno de ${planRefund} créditos do plano`,
                        generationId,
                    },
                });
            }
            if (bonusRefund > 0) {
                await tx.creditTransaction.create({
                    data: {
                        userId,
                        type: client_1.CreditTransactionType.GENERATION_REFUND,
                        amount: bonusRefund,
                        source: 'bonus',
                        description: `Estorno de ${bonusRefund} créditos bônus`,
                        generationId,
                    },
                });
            }
        });
    }
    async partialRefund(userId, refundAmount, generationId, description) {
        if (refundAmount <= 0)
            return;
        await this.prisma.$transaction(async (tx) => {
            const debitTransactions = await tx.creditTransaction.findMany({
                where: {
                    generationId,
                    type: client_1.CreditTransactionType.GENERATION_DEBIT,
                },
                orderBy: { createdAt: 'asc' },
            });
            let planRefund = 0;
            let bonusRefund = 0;
            if (debitTransactions.length > 0) {
                const totalDebited = debitTransactions.reduce((sum, d) => sum + Math.abs(d.amount), 0);
                const planDebited = debitTransactions
                    .filter((d) => d.source === 'plan')
                    .reduce((sum, d) => sum + Math.abs(d.amount), 0);
                const bonusDebited = totalDebited - planDebited;
                planRefund = Math.round((planDebited / totalDebited) * refundAmount);
                bonusRefund = refundAmount - planRefund;
                if (planRefund > planDebited) {
                    planRefund = planDebited;
                    bonusRefund = refundAmount - planRefund;
                }
                if (bonusRefund > bonusDebited) {
                    bonusRefund = bonusDebited;
                    planRefund = refundAmount - bonusRefund;
                }
            }
            else {
                bonusRefund = refundAmount;
            }
            const balance = await tx.creditBalance.findUnique({
                where: { userId },
            });
            if (!balance) {
                throw new common_1.NotFoundException('Saldo de créditos não encontrado');
            }
            await tx.creditBalance.update({
                where: { userId },
                data: {
                    planCreditsRemaining: balance.planCreditsRemaining + planRefund,
                    bonusCreditsRemaining: balance.bonusCreditsRemaining + bonusRefund,
                    planCreditsUsed: balance.planCreditsUsed - planRefund,
                },
            });
            const refundDesc = description || `Estorno parcial de ${refundAmount} créditos`;
            if (planRefund > 0) {
                await tx.creditTransaction.create({
                    data: {
                        userId,
                        type: client_1.CreditTransactionType.GENERATION_REFUND,
                        amount: planRefund,
                        source: 'plan',
                        description: refundDesc,
                        generationId,
                    },
                });
            }
            if (bonusRefund > 0) {
                await tx.creditTransaction.create({
                    data: {
                        userId,
                        type: client_1.CreditTransactionType.GENERATION_REFUND,
                        amount: bonusRefund,
                        source: 'bonus',
                        description: refundDesc,
                        generationId,
                    },
                });
            }
        });
    }
};
exports.CreditsService = CreditsService;
exports.CreditsService = CreditsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        plans_service_1.PlansService])
], CreditsService);
//# sourceMappingURL=credits.service.js.map