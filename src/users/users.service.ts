import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserProfileResponseDto } from './dto/user-profile-response.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string): Promise<UserProfileResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, isActive: true },
      include: {
        subscriptions: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { plan: true },
        },
        creditBalance: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const activeSubscription = user.subscriptions[0] || null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      plan: activeSubscription
        ? {
            slug: activeSubscription.plan.slug,
            name: activeSubscription.plan.name,
            priceCents: activeSubscription.plan.priceCents,
            maxConcurrentGenerations:
              activeSubscription.plan.maxConcurrentGenerations,
            hasWatermark: activeSubscription.plan.hasWatermark,
            hasApiAccess: activeSubscription.plan.hasApiAccess,
          }
        : null,
      credits: user.creditBalance
        ? {
            planCreditsRemaining:
              user.creditBalance.planCreditsRemaining,
            bonusCreditsRemaining:
              user.creditBalance.bonusCreditsRemaining,
            planCreditsUsed: user.creditBalance.planCreditsUsed,
            periodStart: user.creditBalance.periodStart,
            periodEnd: user.creditBalance.periodEnd,
          }
        : null,
      subscription: activeSubscription
        ? {
            status: activeSubscription.status,
            currentPeriodStart: activeSubscription.currentPeriodStart,
            currentPeriodEnd: activeSubscription.currentPeriodEnd,
            cancelAtPeriodEnd: activeSubscription.cancelAtPeriodEnd,
          }
        : null,
    };
  }

  async updateProfile(
    userId: string,
    dto: UpdateUserDto,
  ): Promise<UserProfileResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, isActive: true },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
      },
    });

    return this.getProfile(userId);
  }

  async deleteAccount(userId: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, isActive: true },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    await this.prisma.$transaction(async (tx) => {
      // Soft delete
      await tx.user.update({
        where: { id: userId },
        data: { isActive: false },
      });

      // Revoke all refresh tokens
      await tx.refreshToken.updateMany({
        where: { userId },
        data: { revoked: true },
      });
    });

    return { message: 'Conta desativada com sucesso' };
  }
}
