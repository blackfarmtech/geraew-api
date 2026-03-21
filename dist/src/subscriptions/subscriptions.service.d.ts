import { PrismaService } from '../prisma/prisma.service';
import { PlansService } from '../plans/plans.service';
import { StripeService } from '../payments/stripe.service';
import { SubscriptionResponseDto } from './dto/subscription-response.dto';
export declare class SubscriptionsService {
    private readonly prisma;
    private readonly plansService;
    private readonly stripeService;
    constructor(prisma: PrismaService, plansService: PlansService, stripeService: StripeService);
    getCurrentSubscription(userId: string): Promise<SubscriptionResponseDto | null>;
    createSubscription(userId: string, planSlug: string): Promise<{
        checkoutUrl: string;
    }>;
    upgrade(userId: string, planSlug: string): Promise<{
        checkoutUrl: string;
    }>;
    downgrade(userId: string, planSlug: string): Promise<SubscriptionResponseDto>;
    cancel(userId: string): Promise<SubscriptionResponseDto>;
    reactivate(userId: string): Promise<SubscriptionResponseDto>;
    private buildCheckoutForPlan;
    private toResponseDto;
}
