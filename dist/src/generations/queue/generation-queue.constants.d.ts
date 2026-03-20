export declare const GENERATION_QUEUE = "generation";
export declare enum GenerationJobName {
    IMAGE = "image",
    IMAGE_WITH_FALLBACK = "image-with-fallback",
    IMAGE_NANO_BANANA = "image-nano-banana",
    TEXT_TO_VIDEO = "text-to-video",
    IMAGE_TO_VIDEO = "image-to-video",
    REFERENCE_VIDEO = "reference-video",
    MOTION_CONTROL = "motion-control"
}
interface BaseJobData {
    generationId: string;
    userId: string;
    creditsConsumed: number;
}
export interface ImageJobData extends BaseJobData {
    prompt: string;
    model: string;
    resolution: string;
    aspectRatio?: string;
    mimeType?: string;
    hasInputImages: boolean;
}
export interface ImageNanoBananaJobData extends BaseJobData {
    prompt: string;
    model: string;
    resolution: string;
    aspectRatio?: string;
    outputFormat?: string;
    googleSearch?: boolean;
    imageUrls?: string[];
}
export interface TextToVideoJobData extends BaseJobData {
    prompt: string;
    model: string;
    resolution: string;
    durationSeconds?: number;
    aspectRatio?: string;
    generateAudio: boolean;
    sampleCount?: number;
    negativePrompt?: string;
}
export interface ImageToVideoJobData extends TextToVideoJobData {
    resolvedModel: string;
}
export interface ReferenceVideoJobData extends TextToVideoJobData {
    resolvedModel: string;
}
export interface MotionControlJobData extends BaseJobData {
    videoUrl: string;
    imageUrl: string;
    wanResolution: string;
}
export type GenerationJobData = ImageJobData | ImageNanoBananaJobData | TextToVideoJobData | ImageToVideoJobData | ReferenceVideoJobData | MotionControlJobData;
export declare const IMAGE_JOB_TIMEOUT: number;
export declare const VIDEO_JOB_TIMEOUT: number;
export {};
