import { Module } from '@nestjs/common';
import { PromptEnhancerController } from './prompt-enhancer.controller';
import { PromptEnhancerService } from './prompt-enhancer.service';
import { LlmChatClient } from './llm-chat.client';

@Module({
  controllers: [PromptEnhancerController],
  providers: [PromptEnhancerService, LlmChatClient],
  exports: [PromptEnhancerService],
})
export class PromptEnhancerModule {}
