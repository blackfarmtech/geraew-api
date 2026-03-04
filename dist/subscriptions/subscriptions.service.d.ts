import { PrismaService } from '../prisma/prisma.service';
import { PlansService } from '../plans/plans.service';
import { SubscriptionResponseDto } from './dto/subscription-response.dto';
export declare class SubscriptionsService {
    private readonly prisma;
    private readonly plansService;
    constructor(prisma: PrismaService, plansService: PlansService);
    getCurrentSubscription(userId: string): Promise<SubscriptionResponseDto | null>;
    createSubscription(userId: string, planSlug: string): Promise<SubscriptionResponseDto>;
    upgrade(userId: string, planSlug: string): Promise<SubscriptionResponseDto>;
    downgrade(userId: string, planSlug: string): Promise<SubscriptionResponseDto>;
    cancel(userId: string): Promise<SubscriptionResponseDto>;
    reactivate(userId: string): Promise<SubscriptionResponseDto>;
    private toResponseDto;
}
