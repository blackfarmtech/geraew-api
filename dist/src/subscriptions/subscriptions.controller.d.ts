import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { SubscriptionResponseDto } from './dto/subscription-response.dto';
export declare class SubscriptionsController {
    private readonly subscriptionsService;
    constructor(subscriptionsService: SubscriptionsService);
    getCurrent(userId: string): Promise<SubscriptionResponseDto | null>;
    create(userId: string, dto: CreateSubscriptionDto): Promise<{
        checkoutUrl: string;
    }>;
    upgrade(userId: string, dto: CreateSubscriptionDto): Promise<SubscriptionResponseDto>;
    downgrade(userId: string, dto: CreateSubscriptionDto): Promise<SubscriptionResponseDto>;
    cancel(userId: string): Promise<SubscriptionResponseDto>;
    reactivate(userId: string): Promise<SubscriptionResponseDto>;
}
