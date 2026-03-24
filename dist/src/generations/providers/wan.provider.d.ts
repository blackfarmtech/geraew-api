import { ConfigService } from '@nestjs/config';
import { UploadsService } from '../../uploads/uploads.service';
import { GenerationResult } from './geraew.provider';
export interface WanAnimateReplaceInput {
    id: string;
    videoUrl: string;
    imageUrl: string;
    resolution: string;
    prompt?: string;
}
export declare class WanProvider {
    private readonly configService;
    private readonly uploadsService;
    private readonly logger;
    private readonly baseUrl;
    private readonly apiKey;
    constructor(configService: ConfigService, uploadsService: UploadsService);
    generateAnimateReplace(input: WanAnimateReplaceInput): Promise<GenerationResult>;
    private pollTaskStatus;
    private downloadAndUpload;
    private fetchWithTimeout;
    private headers;
}
