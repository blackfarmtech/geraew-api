import { GenerationType, Resolution } from '@prisma/client';
export declare class EstimateCostDto {
    type: GenerationType;
    resolution: Resolution;
    durationSeconds?: number;
    hasAudio?: boolean;
    sampleCount?: number;
    modelVariant?: string;
}
export declare class EstimateCostResponseDto {
    creditsRequired: number;
    hasSufficientBalance: boolean;
}
