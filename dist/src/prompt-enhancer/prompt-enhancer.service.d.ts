import { ConfigService } from '@nestjs/config';
import { EnhanceInfluencerDto } from './dto/enhance-influencer.dto';
export declare class PromptEnhancerService {
    private configService;
    private readonly logger;
    private openai;
    constructor(configService: ConfigService);
    enhance(prompt: string): Promise<string>;
    enhanceInfluencer(selections: EnhanceInfluencerDto): Promise<string>;
}
