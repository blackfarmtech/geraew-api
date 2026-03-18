import { ConfigService } from '@nestjs/config';
import { UploadsService } from '../../uploads/uploads.service';
export interface TextToVideoInput {
    id: string;
    prompt: string;
    model: string;
    durationSeconds?: number;
    aspectRatio?: string;
    resolution: string;
    generateAudio: boolean;
    sampleCount?: number;
    negativePrompt?: string;
}
export interface ImageToVideoInput extends TextToVideoInput {
    firstFrame: string;
    firstFrameMimeType: string;
    lastFrame?: string;
    lastFrameMimeType?: string;
}
export interface ReferenceVideoInput extends TextToVideoInput {
    referenceImages: Array<{
        base64: string;
        mimeType: string;
        referenceType: 'asset' | 'style';
    }>;
}
export interface ImageGenerationInput {
    id: string;
    prompt: string;
    model: string;
    resolution: string;
    aspectRatio?: string;
    mimeType?: string;
    images?: Array<{
        base64: string;
        mimeType: string;
    }>;
}
export interface GenerationResult {
    outputUrls: string[];
    modelUsed: string;
}
export declare class GeraewProvider {
    private readonly configService;
    private readonly uploadsService;
    private readonly logger;
    private readonly baseUrl;
    private readonly apiKey;
    constructor(configService: ConfigService, uploadsService: UploadsService);
    generateImage(input: ImageGenerationInput): Promise<GenerationResult>;
    generateTextToVideo(input: TextToVideoInput): Promise<GenerationResult>;
    generateImageToVideo(input: ImageToVideoInput): Promise<GenerationResult>;
    generateVideoWithReferences(input: ReferenceVideoInput): Promise<GenerationResult>;
    private buildVideoBody;
    private startAndPollVideo;
    private pollVideoStatus;
    private downloadFromGcs;
    private fetchWithTimeout;
    private headers;
}
