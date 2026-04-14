import { Module } from '@nestjs/common';
import { PromptAgentController } from './prompt-agent.controller';
import { PromptAgentService } from './prompt-agent.service';
import { CreditsModule } from '../credits/credits.module';

@Module({
  imports: [CreditsModule],
  controllers: [PromptAgentController],
  providers: [PromptAgentService],
})
export class PromptAgentModule {}
