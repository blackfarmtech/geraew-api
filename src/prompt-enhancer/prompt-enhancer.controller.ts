import { Body, Controller, Post } from '@nestjs/common';
import { PromptEnhancerService } from './prompt-enhancer.service';
import { EnhancePromptDto } from './dto/enhance-prompt.dto';

@Controller('api/v1/prompt-enhancer')
export class PromptEnhancerController {
  constructor(private readonly promptEnhancerService: PromptEnhancerService) {}

  @Post('enhance')
  async enhance(@Body() dto: EnhancePromptDto) {
    const enhanced = await this.promptEnhancerService.enhance(dto.prompt);
    return { enhancedPrompt: enhanced };
  }
}
