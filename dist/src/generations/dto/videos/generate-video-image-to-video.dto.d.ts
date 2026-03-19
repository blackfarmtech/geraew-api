import { Resolution } from '@prisma/client';
export declare class GenerateVideoImageToVideoDto {
    prompt: string;
    model?: string;
    resolution: Resolution;
    duration_seconds?: number;
    aspect_ratio?: string;
    generate_audio?: boolean;
    sample_count?: number;
    negative_prompt?: string;
    first_frame: string;
    first_frame_mime_type?: string;
    last_frame?: string;
    last_frame_mime_type?: string;
}
