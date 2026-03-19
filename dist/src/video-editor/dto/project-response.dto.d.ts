import { VideoProjectStatus } from '@prisma/client';
export declare class ClipResponseDto {
    id: string;
    sourceUrl: string;
    thumbnailUrl?: string;
    order: number;
    startMs: number;
    endMs?: number;
    durationMs: number;
    createdAt: Date;
}
export declare class ProjectResponseDto {
    id: string;
    name: string;
    status: VideoProjectStatus;
    outputUrl?: string;
    outputThumbnailUrl?: string;
    durationMs?: number;
    errorMessage?: string;
    createdAt: Date;
    updatedAt: Date;
    clips?: ClipResponseDto[];
}
