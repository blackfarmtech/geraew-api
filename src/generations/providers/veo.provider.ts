import { Injectable, Logger } from '@nestjs/common';
import { BaseProvider, GenerationInput, GenerationResult } from './base.provider';

@Injectable()
export class VeoProvider extends BaseProvider {
  private readonly logger = new Logger(VeoProvider.name);

  async generate(input: GenerationInput): Promise<GenerationResult> {
    this.logger.log(`[MVP Stub] Generating video with Veo 3.1 — ${input.type} ${input.resolution} ${input.durationSeconds}s audio:${input.hasAudio}`);

    // MVP: simulate API call with delay
    await new Promise((resolve) => setTimeout(resolve, 5000));

    return {
      outputUrl: `https://mock-cdn.example.com/generations/${input.id}/output.mp4`,
      thumbnailUrl: `https://mock-cdn.example.com/generations/${input.id}/thumbnail.jpg`,
      modelUsed: 'veo-3.1',
    };
  }
}
