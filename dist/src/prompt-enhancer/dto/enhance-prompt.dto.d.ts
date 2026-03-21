export declare class ReferenceImageDto {
    base64: string;
    mime_type: string;
}
export declare class GenerationContextDto {
    type: 'image' | 'video';
    model?: string;
    resolution?: string;
    aspectRatio?: string;
    quality?: string;
    durationSeconds?: number;
    hasAudio?: boolean;
    hasReferenceImages?: boolean;
    hasFirstFrame?: boolean;
    hasLastFrame?: boolean;
    negativePrompt?: string;
    sampleCount?: number;
}
export declare class EnhancePromptDto {
    prompt: string;
    context?: GenerationContextDto;
    images?: ReferenceImageDto[];
}
