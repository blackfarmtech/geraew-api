import { PrismaService } from '../prisma/prisma.service';
export declare class SubscriptionRenewalService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    handleSubscriptionRenewal(): Promise<void>;
    handleFreePlanDailyReset(): Promise<void>;
    private renewSubscription;
}
