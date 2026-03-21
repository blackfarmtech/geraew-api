export declare class SubscriptionPlanDto {
    id: string;
    slug: string;
    name: string;
    priceCents: number;
    creditsPerMonth: number;
    maxConcurrentGenerations: number;
    hasWatermark: boolean;
    galleryRetentionDays: number | null;
    hasApiAccess: boolean;
}
export declare class ScheduledPlanDto {
    id: string;
    slug: string;
    name: string;
    priceCents: number;
    creditsPerMonth: number;
}
export declare class SubscriptionResponseDto {
    id: string;
    status: string;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean;
    paymentProvider: string | null;
    paymentRetryCount: number;
    createdAt: Date;
    plan: SubscriptionPlanDto;
    scheduledPlan?: ScheduledPlanDto;
}
