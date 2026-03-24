export declare class GenerationsByStatusDto {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
}
export declare class AdminStatsResponseDto {
    totalUsers: number;
    activeSubscriptions: number;
    totalRevenueCents: number;
    totalGenerations: number;
    generationsByStatus: GenerationsByStatusDto;
}
