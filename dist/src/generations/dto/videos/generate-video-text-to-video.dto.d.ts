import { Resolution } from '@prisma/client';
export declare class GenerateVideoTextToVideoDto {
    prompt: string;
    model: string;
    resolution: Resolution;
    duration_seconds?: number;
    aspect_ratio?: string;
    generate_audio?: boolean;
    sample_count?: number;
    negative_prompt?: string;
    model_variant?: string;
}
