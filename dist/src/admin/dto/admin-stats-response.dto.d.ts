export declare class GenerationsByStatusDto {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
}
export declare class KieBreakdownDto {
    nanoBanana2: number;
    nanoBananaPro: number;
    kling: number;
}
export declare class GenerationsByProviderDto {
    geraew: number;
    kie: number;
    kieBreakdown: KieBreakdownDto;
}
export declare class AdminStatsResponseDto {
    totalUsers: number;
    activeSubscriptions: number;
    totalRevenueCents: number;
    totalGenerations: number;
    generationsByStatus: GenerationsByStatusDto;
    generationsByProvider: GenerationsByProviderDto;
}
