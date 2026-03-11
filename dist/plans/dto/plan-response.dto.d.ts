export declare class PlanResponseDto {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    priceCents: number;
    creditsPerMonth: number;
    maxConcurrentGenerations: number;
    hasWatermark: boolean;
    galleryRetentionDays: number | null;
    hasApiAccess: boolean;
}
export declare class CreditPackageResponseDto {
    id: string;
    name: string;
    credits: number;
    priceCents: number;
}
