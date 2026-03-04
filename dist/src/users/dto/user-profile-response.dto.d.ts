export declare class PlanInfoDto {
    slug: string;
    name: string;
    priceCents: number;
    maxConcurrentGenerations: number;
    hasWatermark: boolean;
    hasApiAccess: boolean;
}
export declare class CreditInfoDto {
    planCreditsRemaining: number;
    bonusCreditsRemaining: number;
    planCreditsUsed: number;
    periodStart: Date | null;
    periodEnd: Date | null;
}
export declare class SubscriptionInfoDto {
    status: string;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean;
}
export declare class UserProfileResponseDto {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    role: string;
    emailVerified: boolean;
    createdAt: Date;
    plan: PlanInfoDto | null;
    credits: CreditInfoDto | null;
    subscription: SubscriptionInfoDto | null;
}
