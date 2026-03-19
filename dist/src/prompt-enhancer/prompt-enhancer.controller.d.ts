import { PromptEnhancerService } from './prompt-enhancer.service';
import { EnhancePromptDto } from './dto/enhance-prompt.dto';
export declare class PromptEnhancerController {
    private readonly promptEnhancerService;
    constructor(promptEnhancerService: PromptEnhancerService);
    enhance(dto: EnhancePromptDto): Promise<{
        enhancedPrompt: string;
    }>;
}
