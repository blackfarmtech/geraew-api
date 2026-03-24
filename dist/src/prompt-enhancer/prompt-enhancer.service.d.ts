import { ConfigService } from '@nestjs/config';
import { EnhanceInfluencerDto } from './dto/enhance-influencer.dto';
export interface GenerationContext {
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
export declare class PromptEnhancerService {
    private configService;
    private readonly logger;
    private anthropic;
    private static readonly MAX_IMAGE_BYTES;
    constructor(configService: ConfigService);
    private compressImageForVision;
    enhance(prompt: string, context?: GenerationContext, images?: {
        base64: string;
        mime_type: string;
    }[]): Promise<{
        prompt: string;
        negativePrompt: string;
    }>;
    private static readonly SAFETY_REFINER_SYSTEM_PROMPT;
    refinePromptForSafety(originalPrompt: string): Promise<string | null>;
    enhanceInfluencer(selections: EnhanceInfluencerDto): Promise<string>;
}
