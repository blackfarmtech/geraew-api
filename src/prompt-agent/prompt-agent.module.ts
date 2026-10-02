import { Module } from '@nestjs/common';
import { PromptAgentController } from './prompt-agent.controller';
import { PromptAgentService } from './prompt-agent.service';
import { CreditsModule } from '../credits/credits.module';
import { LlmChatClient } from '../prompt-enhancer/llm-chat.client';

@Module({
  imports: [CreditsModule],
  controllers: [PromptAgentController],
  providers: [PromptAgentService, LlmChatClient],
})
export class PromptAgentModule {}
