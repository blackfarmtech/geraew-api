import { ConfigService } from '@nestjs/config';
import { BaseProvider, GenerationInput, GenerationResult } from './base.provider';
import { UploadsService } from '../../uploads/uploads.service';
export declare class NanoBananaProvider extends BaseProvider {
    private readonly configService;
    private readonly uploadsService;
    private readonly logger;
    private readonly apiKey;
    private readonly baseUrl;
    private static readonly POLL_INTERVAL_MS;
    private static readonly MAX_POLL_ATTEMPTS;
    constructor(configService: ConfigService, uploadsService: UploadsService);
    generate(input: GenerationInput): Promise<GenerationResult>;
    private submitTask;
    private pollTaskResult;
    private sleep;
}
