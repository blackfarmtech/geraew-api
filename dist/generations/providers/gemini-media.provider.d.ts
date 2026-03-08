import { ConfigService } from '@nestjs/config';
import { BaseProvider, GenerationInput, GenerationResult } from './base.provider';
import { UploadsService } from '../../uploads/uploads.service';
export declare class GeminiMediaProvider extends BaseProvider {
    private readonly configService;
    private readonly uploadsService;
    private readonly logger;
    private readonly baseUrl;
    private static readonly POLL_INTERVAL_MS;
    private static readonly MAX_POLL_ATTEMPTS;
    constructor(configService: ConfigService, uploadsService: UploadsService);
    generate(input: GenerationInput): Promise<GenerationResult>;
    private generateImage;
    private generateTextToVideo;
    private generateImageToVideo;
    private submitVideoGeneration;
    private pollAndUploadVideo;
    private pollVideoStatus;
    private resolveVideoAspectRatio;
    private resolveImageAspectRatio;
    private downloadImageAsBase64;
    private sleep;
}
