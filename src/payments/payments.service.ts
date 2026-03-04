import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentStatus, PaymentType, Prisma } from '@prisma/client';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createPayment(
    userId: string,
    type: PaymentType,
    amountCents: number,
    provider: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    return this.prisma.payment.create({
      data: {
        userId,
        type,
        amountCents,
        provider,
        metadata: metadata ?? Prisma.JsonNull,
      },
    });
  }

  async updatePaymentStatus(
    id: string,
    status: PaymentStatus,
    externalPaymentId?: string,
  ) {
    return this.prisma.payment.update({
      where: { id },
      data: {
        status,
        ...(externalPaymentId && { externalPaymentId }),
      },
    });
  }

  async findByExternalPaymentId(externalPaymentId: string) {
    return this.prisma.payment.findFirst({
      where: { externalPaymentId },
    });
  }

  async processSubscriptionPayment(paymentId: string): Promise<void> {
    // TODO: Implement real subscription payment processing
    // 1. Find payment and related subscription
    // 2. Update subscription status to active
    // 3. Reset plan credits for the new period
    // 4. Create credit transaction for subscription_renewal
    this.logger.log(
      `Processing subscription payment: ${paymentId} (stub — not yet implemented)`,
    );
  }

  async processCreditPurchase(paymentId: string): Promise<void> {
    // TODO: Implement real credit purchase processing
    // 1. Find payment and related credit package
    // 2. Add bonus credits to user balance
    // 3. Create credit transaction for purchase
    this.logger.log(
      `Processing credit purchase: ${paymentId} (stub — not yet implemented)`,
    );
  }
}
