export declare class GenerationsByTypeDto {
    TEXT_TO_IMAGE: number;
    IMAGE_TO_IMAGE: number;
    TEXT_TO_VIDEO: number;
    IMAGE_TO_VIDEO: number;
    MOTION_CONTROL: number;
}
export declare class GalleryStatsResponseDto {
    totalGenerations: number;
    totalCreditsUsed: number;
    generationsByType: GenerationsByTypeDto;
    favoriteCount: number;
}
