import { Module } from '@nestjs/common';
import { PromptEnhancerController } from './prompt-enhancer.controller';
import { PromptEnhancerService } from './prompt-enhancer.service';

@Module({
  controllers: [PromptEnhancerController],
  providers: [PromptEnhancerService],
})
export class PromptEnhancerModule {}
