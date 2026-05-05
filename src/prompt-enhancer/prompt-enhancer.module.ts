import { Module } from '@nestjs/common';
import { PromptEnhancerController } from './prompt-enhancer.controller';
import { PromptEnhancerService } from './prompt-enhancer.service';
import { GeraewChatClient } from './geraew-chat.client';

@Module({
  controllers: [PromptEnhancerController],
  providers: [PromptEnhancerService, GeraewChatClient],
  exports: [PromptEnhancerService],
})
export class PromptEnhancerModule {}
