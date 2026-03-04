import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { Subscription, SubscriptionStatus } from '@prisma/client';

const MAX_RETRY_COUNT = 3;

@Injectable()
export class PaymentRetryService {
  private readonly logger = new Logger(PaymentRetryService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 */6 * * *')
  async handlePaymentRetry() {
    try {
      const pastDueSubscriptions = await this.prisma.subscription.findMany({
        where: {
          status: SubscriptionStatus.PAST_DUE,
        },
        include: { plan: true, user: true },
      });

      this.logger.log(
        `Found ${pastDueSubscriptions.length} past-due subscriptions to process`,
      );

      for (const subscription of pastDueSubscriptions) {
        try {
          if (subscription.paymentRetryCount >= MAX_RETRY_COUNT) {
            await this.downgradeToFree(subscription);
          } else {
            await this.retryPayment(subscription);
          }
        } catch (error) {
          this.logger.error(
            `Failed to process past-due subscription ${subscription.id}: ${error.message}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Payment retry cron failed: ${error.message}`,
        error.stack,
      );
    }
  }

  private async retryPayment(subscription: Subscription) {
    // TODO: Integrate with Stripe/MercadoPago to actually retry the payment
    // For now, just increment the retry count
    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        paymentRetryCount: subscription.paymentRetryCount + 1,
      },
    });

    this.logger.log(
      `Incremented retry count for subscription ${subscription.id} (retry #${subscription.paymentRetryCount + 1})`,
    );
  }

  private async downgradeToFree(subscription: Subscription) {
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
      // Cancel the current subscription
      await tx.subscription.update({
        where: { id: subscription.id },
        data: { status: SubscriptionStatus.CANCELED },
      });

      // Create a new Free subscription
      await tx.subscription.create({
        data: {
          userId: subscription.userId,
          planId: freePlan.id,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      });

      // Reset credits to Free plan values
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

    this.logger.warn(
      `Downgraded subscription ${subscription.id} for user ${subscription.userId} to Free plan after ${MAX_RETRY_COUNT} failed retries`,
    );
  }
}
