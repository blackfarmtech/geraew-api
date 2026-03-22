import { Resolution } from '@prisma/client';
export declare class ImageInputDto {
    base64: string;
    mime_type?: string;
}
export declare class GenerateImageDto {
    prompt: string;
    model: string;
    resolution: Resolution;
    aspect_ratio?: string;
    mime_type?: string;
    images?: ImageInputDto[];
    model_variant?: string;
}
