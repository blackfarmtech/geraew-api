import { Resolution } from '@prisma/client';
export declare class ReferenceImageDto {
    base64: string;
    mime_type?: string;
    reference_type: 'asset' | 'style';
}
export declare class GenerateVideoWithReferencesDto {
    prompt: string;
    model?: string;
    resolution: Resolution;
    duration_seconds?: number;
    aspect_ratio?: string;
    generate_audio?: boolean;
    sample_count?: number;
    negative_prompt?: string;
    reference_images?: ReferenceImageDto[];
    model_variant?: string;
}
