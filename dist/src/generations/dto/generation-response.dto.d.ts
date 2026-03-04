import { GenerationType, GenerationStatus, Resolution } from '@prisma/client';
export declare class GenerationResponseDto {
    id: string;
    type: GenerationType;
    status: GenerationStatus;
    prompt?: string;
    negativePrompt?: string;
    inputImageUrl?: string;
    referenceVideoUrl?: string;
    resolution: Resolution;
    durationSeconds?: number;
    hasAudio: boolean;
    modelUsed?: string;
    parameters?: Record<string, unknown>;
    outputUrl?: string;
    thumbnailUrl?: string;
    hasWatermark: boolean;
    creditsConsumed: number;
    processingTimeMs?: number;
    errorMessage?: string;
    errorCode?: string;
    isFavorited: boolean;
    createdAt: Date;
    completedAt?: Date;
}
export declare class CreateGenerationResponseDto {
    id: string;
    status: GenerationStatus;
    creditsConsumed: number;
}
