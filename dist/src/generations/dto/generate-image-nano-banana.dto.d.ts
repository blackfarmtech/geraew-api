import { Resolution } from '@prisma/client';
export declare class NanoBananaImageInputDto {
    base64: string;
    mime_type?: string;
}
export declare class GenerateImageNanoBananaDto {
    model?: string;
    prompt: string;
    resolution: Resolution;
    aspect_ratio?: string;
    output_format?: string;
    google_search?: boolean;
    images?: NanoBananaImageInputDto[];
    model_variant?: string;
}
