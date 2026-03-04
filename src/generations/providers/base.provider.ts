export interface GenerationResult {
  outputUrl: string;
  thumbnailUrl?: string;
  modelUsed: string;
}

export interface GenerationInput {
  id: string;
  type: string;
  prompt?: string;
  negativePrompt?: string;
  inputImageUrl?: string;
  referenceVideoUrl?: string;
  resolution: string;
  durationSeconds?: number;
  hasAudio: boolean;
  parameters?: Record<string, unknown>;
}

export abstract class BaseProvider {
  abstract generate(input: GenerationInput): Promise<GenerationResult>;
}
