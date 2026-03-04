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
    async processSubscriptionPayment(paymentId) {
        this.logger.log(`Processing subscription payment: ${paymentId} (stub — not yet implemented)`);
    }
    async processCreditPurchase(paymentId) {
        this.logger.log(`Processing credit purchase: ${paymentId} (stub — not yet implemented)`);
    }
};
exports.PaymentsService = PaymentsService;
exports.PaymentsService = PaymentsService = PaymentsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PaymentsService);
//# sourceMappingURL=payments.service.js.map