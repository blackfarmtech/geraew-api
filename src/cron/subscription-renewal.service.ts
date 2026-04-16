import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { CreditTransactionType, Plan, Subscription, SubscriptionStatus } from '@prisma/client';

@Injectable()
export class SubscriptionRenewalService {
  private readonly logger = new Logger(SubscriptionRenewalService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 * * * *')
  async handleSubscriptionRenewal() {
    try {
      const now = new Date();

      const expiredSubscriptions = await this.prisma.subscription.findMany({
        where: {
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd: { lte: now },
          cancelAtPeriodEnd: false,
        },
        include: { plan: true },
      });

      this.logger.log(
        `Found ${expiredSubscriptions.length} subscriptions to renew`,
      );

      for (const subscription of expiredSubscriptions) {
        try {
          await this.renewSubscription(subscription);
        } catch (error) {
          this.logger.error(
            `Failed to renew subscription ${subscription.id}: ${error.message}`,
          );
        }
      }

      // Handle subscriptions that should be canceled at period end
      const cancelingSubscriptions = await this.prisma.subscription.findMany({
        where: {
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd: { lte: now },
          cancelAtPeriodEnd: true,
        },
      });

      for (const subscription of cancelingSubscriptions) {
        try {
          await this.prisma.subscription.update({
            where: { id: subscription.id },
            data: { status: SubscriptionStatus.CANCELED },
          });

          this.logger.log(
            `Canceled subscription ${subscription.id} at period end`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to cancel subscription ${subscription.id}: ${error.message}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Subscription renewal cron failed: ${error.message}`,
        error.stack,
      );
    }
  }

  private async renewSubscription(
    subscription: Subscription & { plan: Plan },
  ) {
    const newPeriodStart = subscription.currentPeriodEnd;
    const newPeriodEnd = new Date(newPeriodStart);
    newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);

    // Plans without monthly renewal (creditsPerMonth === 0) only advance the
    // period — saldo é preservado. Usado pelo Free em v5 (sem créditos).
    if (subscription.plan.creditsPerMonth === 0) {
      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          currentPeriodStart: newPeriodStart,
          currentPeriodEnd: newPeriodEnd,
        },
      });

      this.logger.log(
        `Advanced period for subscription ${subscription.id} (plan "${subscription.plan.slug}" has no monthly credits)`,
      );
      return;
    }

    const credits = subscription.plan.creditsPerMonth;

    await this.prisma.$transaction(async (tx) => {
      // Update subscription period
      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          currentPeriodStart: newPeriodStart,
          currentPeriodEnd: newPeriodEnd,
        },
      });

      // Reset plan credits for the new period
      await tx.creditBalance.upsert({
        where: { userId: subscription.userId },
        create: {
          userId: subscription.userId,
          planCreditsRemaining: credits,
          bonusCreditsRemaining: 0,
          planCreditsUsed: 0,
          periodStart: newPeriodStart,
          periodEnd: newPeriodEnd,
        },
        update: {
          planCreditsRemaining: credits,
          planCreditsUsed: 0,
          periodStart: newPeriodStart,
          periodEnd: newPeriodEnd,
        },
      });

      // Record the credit transaction
      if (credits > 0) {
        await tx.creditTransaction.create({
          data: {
            userId: subscription.userId,
            type: CreditTransactionType.SUBSCRIPTION_RENEWAL,
            amount: credits,
            source: 'plan',
            description: `Renovação do plano ${subscription.plan.name} — ${credits} créditos`,
          },
        });
      }
    });

    this.logger.log(
      `Renewed subscription ${subscription.id} for user ${subscription.userId} (${credits} credits)`,
    );
  }
}
