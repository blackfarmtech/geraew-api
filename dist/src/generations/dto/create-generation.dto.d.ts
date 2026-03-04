import { Resolution } from '@prisma/client';
export declare class CreateGenerationDto {
    negativePrompt?: string;
    resolution: Resolution;
    aspectRatio?: string;
    outputFormat?: string;
    googleSearch?: boolean;
    parameters?: Record<string, unknown>;
}
