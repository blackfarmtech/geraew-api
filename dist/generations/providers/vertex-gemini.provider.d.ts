import { ConfigService } from '@nestjs/config';
import { BaseProvider, GenerationInput, GenerationResult } from './base.provider';
import { UploadsService } from '../../uploads/uploads.service';
export declare class VertexGeminiProvider extends BaseProvider {
    private readonly configService;
    private readonly uploadsService;
    private readonly logger;
    private readonly baseUrl;
    private readonly apiKey;
    constructor(configService: ConfigService, uploadsService: UploadsService);
    generate(input: GenerationInput): Promise<GenerationResult>;
    private generateImage;
    private resolveAspectRatio;
    private downloadImageAsBase64;
}
