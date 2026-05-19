import { Module } from '@nestjs/common';
import { PromptAgentController } from './prompt-agent.controller';
import { PromptAgentService } from './prompt-agent.service';
import { CreditsModule } from '../credits/credits.module';
import { GeraewChatClient } from '../prompt-enhancer/geraew-chat.client';

@Module({
  imports: [CreditsModule],
  controllers: [PromptAgentController],
  providers: [PromptAgentService, GeraewChatClient],
})
export class PromptAgentModule {}
