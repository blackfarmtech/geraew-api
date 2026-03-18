import { GenerationType, GenerationStatus, Resolution, GenerationImageRole } from '@prisma/client';
export declare class GenerationOutputDto {
    id: string;
    url: string;
    thumbnailUrl?: string;
    mimeType?: string;
    order: number;
}
export declare class GenerationInputImageDto {
    id: string;
    role: GenerationImageRole;
    mimeType?: string;
    order: number;
    referenceType?: string;
    url?: string;
}
export declare class GenerationFolderDto {
    id: string;
    name: string;
}
export declare class GenerationResponseDto {
    id: string;
    type: GenerationType;
    status: GenerationStatus;
    prompt?: string;
    negativePrompt?: string;
    resolution: Resolution;
    durationSeconds?: number;
    hasAudio: boolean;
    modelUsed?: string;
    parameters?: Record<string, unknown>;
    outputs: GenerationOutputDto[];
    inputImages: GenerationInputImageDto[];
    hasWatermark: boolean;
    creditsConsumed: number;
    processingTimeMs?: number;
    errorMessage?: string;
    errorCode?: string;
    folder?: GenerationFolderDto;
    isFavorited: boolean;
    createdAt: Date;
    completedAt?: Date;
}
export declare class CreateGenerationResponseDto {
    id: string;
    status: GenerationStatus;
    creditsConsumed: number;
}
