import { ConfigService } from '@nestjs/config';
import { UploadsService } from '../../uploads/uploads.service';
import { GenerationResult } from './geraew.provider';
export interface NanoBananaImageInput {
    id: string;
    prompt: string;
    resolution: string;
    aspectRatio?: string;
    outputFormat?: string;
    googleSearch?: boolean;
    imageUrls?: string[];
}
export declare class NanoBananaProvider {
    private readonly configService;
    private readonly uploadsService;
    private readonly logger;
    private readonly baseUrl;
    private readonly apiKey;
    constructor(configService: ConfigService, uploadsService: UploadsService);
    generateImage(input: NanoBananaImageInput): Promise<GenerationResult>;
    private pollTaskStatus;
    private downloadAndUpload;
    private headers;
}
