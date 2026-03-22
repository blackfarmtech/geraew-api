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

  @Cron('0 0 * * *') // midnight every day
  async handleFreePlanDailyReset() {
    this.logger.log('Starting daily free plan credit reset...');

    const freePlan = await this.prisma.plan.findUnique({
      where: { slug: 'free' },
    });

    if (!freePlan) {
      this.logger.warn('Free plan not found, skipping daily reset');
      return;
    }

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    // Find all users on free plan (users with active free subscription OR no active subscription at all)
    const freeSubscriptions = await this.prisma.subscription.findMany({
      where: {
        plan: { slug: 'free' },
        status: 'ACTIVE',
      },
      select: { userId: true },
    });

    const freeUserIds = freeSubscriptions.map((s) => s.userId);

    // Also find users with no active subscription (they're implicitly free)
    const usersWithActiveSubscription =
      await this.prisma.subscription.findMany({
        where: { status: 'ACTIVE' },
        select: { userId: true },
      });
    const activeSubUserIds = new Set(
      usersWithActiveSubscription.map((s) => s.userId),
    );

    const allUsers = await this.prisma.user.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    const implicitFreeUserIds = allUsers
      .filter((u) => !activeSubUserIds.has(u.id))
      .map((u) => u.id);

    const allFreeUserIds = [
      ...new Set([...freeUserIds, ...implicitFreeUserIds]),
    ];

    let resetCount = 0;

    for (const userId of allFreeUserIds) {
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.creditBalance.upsert({
            where: { userId },
            update: {
              planCreditsRemaining: freePlan.creditsPerMonth,
              planCreditsUsed: 0,
              periodStart: startOfDay,
              periodEnd: endOfDay,
            },
            create: {
              userId,
              planCreditsRemaining: freePlan.creditsPerMonth,
              bonusCreditsRemaining: 0,
              planCreditsUsed: 0,
              periodStart: startOfDay,
              periodEnd: endOfDay,
            },
          });
        });
        resetCount++;
      } catch (error) {
        this.logger.error(
          `Failed to reset credits for user ${userId}:`,
          error,
        );
      }
    }

    this.logger.log(
      `Daily free plan reset complete: ${resetCount} users reset`,
    );
  }

  private async renewSubscription(
    subscription: Subscription & { plan: Plan },
  ) {
    const newPeriodStart = subscription.currentPeriodEnd;
    const newPeriodEnd = new Date(newPeriodStart);
    newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);

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

      // Record the credit transaction
      await tx.creditTransaction.create({
        data: {
          userId: subscription.userId,
          type: CreditTransactionType.SUBSCRIPTION_RENEWAL,
          amount: subscription.plan.creditsPerMonth,
          source: 'plan',
          description: `Renovação do plano ${subscription.plan.name} — ${subscription.plan.creditsPerMonth} créditos`,
        },
      });
    });

    this.logger.log(
      `Renewed subscription ${subscription.id} for user ${subscription.userId}`,
    );
  }
}
