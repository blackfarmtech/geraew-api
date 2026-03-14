import { ConfigService } from '@nestjs/config';
export declare class PromptEnhancerService {
    private configService;
    private readonly logger;
    private openai;
    constructor(configService: ConfigService);
    enhance(prompt: string): Promise<string>;
}
