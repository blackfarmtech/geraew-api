import { GenerationType, GenerationStatus, Resolution } from '@prisma/client';
export declare class GalleryItemDto {
    id: string;
    type: GenerationType;
    status: GenerationStatus;
    thumbnailUrl?: string;
    blurDataUrl?: string;
    outputUrl?: string;
    prompt?: string;
    resolution: Resolution;
    durationSeconds?: number;
    hasAudio: boolean;
    hasWatermark: boolean;
    creditsConsumed: number;
    isFavorited: boolean;
    outputCount: number;
    folder?: {
        id: string;
        name: string;
    };
    createdAt: Date;
    completedAt?: Date;
}
