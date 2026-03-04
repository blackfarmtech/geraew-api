import { Injectable, Logger } from '@nestjs/common';
import { BaseProvider, GenerationInput, GenerationResult } from './base.provider';

@Injectable()
export class KlingProvider extends BaseProvider {
  private readonly logger = new Logger(KlingProvider.name);

  async generate(input: GenerationInput): Promise<GenerationResult> {
    this.logger.log(`[MVP Stub] Generating motion control video with Kling 2.6 — ${input.resolution} ${input.durationSeconds}s`);

    // MVP: simulate API call with delay
    await new Promise((resolve) => setTimeout(resolve, 3000));

    return {
      outputUrl: `https://mock-cdn.example.com/generations/${input.id}/output.mp4`,
      thumbnailUrl: `https://mock-cdn.example.com/generations/${input.id}/thumbnail.jpg`,
      modelUsed: 'kling-2.6',
    };
  }
}
