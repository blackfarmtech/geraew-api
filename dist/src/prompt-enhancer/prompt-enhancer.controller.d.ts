import { PromptEnhancerService } from './prompt-enhancer.service';
import { EnhancePromptDto } from './dto/enhance-prompt.dto';
import { EnhanceInfluencerDto } from './dto/enhance-influencer.dto';
export declare class PromptEnhancerController {
    private readonly promptEnhancerService;
    constructor(promptEnhancerService: PromptEnhancerService);
    enhance(dto: EnhancePromptDto): Promise<{
        enhancedPrompt: string;
        negativePrompt: string;
    }>;
    enhanceInfluencer(dto: EnhanceInfluencerDto): Promise<{
        enhancedPrompt: string;
    }>;
}
