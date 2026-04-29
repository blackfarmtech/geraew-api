import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UploadsService } from '../../uploads/uploads.service';
import { GenerationResult } from './geraew.provider';

export interface WavespeedTextToSpeechInput {
  id: string;
  text: string;
  voiceId: string;
  language?: string;
  speed?: number;
}

export interface WavespeedVoiceCloneInput {
  id: string;
  text: string;
  audioUrl: string;
  language?: string;
}

interface CreatePredictionResponse {
  data?: {
    id?: string;
  };
  id?: string;
  code?: number;
  message?: string;
}

interface PredictionResultResponse {
  code?: number;
  message?: string;
  data?: {
    id: string;
    status: 'created' | 'processing' | 'completed' | 'failed';
    outputs?: string[];
    error?: string;
  };
}

@Injectable()
export class WavespeedAudioProvider {
  private readonly logger = new Logger(WavespeedAudioProvider.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly uploadsService: UploadsService,
  ) {
    this.baseUrl = this.configService.get<string>(
      'WAVESPEED_BASE_URL',
      'https://api.wavespeed.ai',
    );
    this.apiKey = this.configService.get<string>('WAVESPEED_API_KEY', '');
  }

  async generateTextToSpeech(
    input: WavespeedTextToSpeechInput,
  ): Promise<GenerationResult> {
    const model = 'wavespeed-ai/omnivoice/text-to-speech';
    const body: Record<string, unknown> = {
      text: input.text,
      voice_id: input.voiceId,
    };
    if (input.language) body.language = input.language;
    if (typeof input.speed === 'number') body.speed = input.speed;

    this.logger.log(
      `[TTS] gen=${input.id} voice=${input.voiceId} language=${input.language ?? 'auto'} speed=${input.speed ?? 1} text="${input.text.slice(0, 80)}"`,
    );

    const predictionId = await this.createPrediction(model, body);
    const audioUrl = await this.pollPrediction(predictionId);
    const outputUrl = await this.downloadAndUpload(audioUrl, input.id, 0);

    return { outputUrls: [outputUrl], modelUsed: model };
  }

  async generateVoiceClone(
    input: WavespeedVoiceCloneInput,
  ): Promise<GenerationResult> {
    const model = 'wavespeed-ai/omnivoice/voice-clone';
    const body: Record<string, unknown> = {
      text: input.text,
      audio: input.audioUrl,
    };
    if (input.language) body.language = input.language;

    this.logger.log(
      `[VOICE_CLONE] gen=${input.id} audio=${input.audioUrl} language=${input.language ?? 'auto'} text="${input.text.slice(0, 80)}"`,
    );

    const predictionId = await this.createPrediction(model, body);
    const audioUrl = await this.pollPrediction(predictionId);
    const outputUrl = await this.downloadAndUpload(audioUrl, input.id, 0);

    return { outputUrls: [outputUrl], modelUsed: model };
  }

  private async createPrediction(
    model: string,
    body: Record<string, unknown>,
  ): Promise<string> {
    const response = await this.fetchWithTimeout(
      `${this.baseUrl}/api/v3/${model}`,
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
      },
      60_000,
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `WaveSpeed createPrediction error (${response.status}): ${errorText}`,
      );
    }

    const data = (await response.json()) as CreatePredictionResponse;
    const predictionId = data.data?.id ?? data.id;
    if (!predictionId) {
      throw new Error(
        `WaveSpeed createPrediction: missing prediction id in response`,
      );
    }
    this.logger.log(`WaveSpeed prediction created: ${predictionId}`);
    return predictionId;
  }

  private async pollPrediction(
    predictionId: string,
    maxAttempts = 90,
    intervalMs = 2_000,
  ): Promise<string> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }

      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/api/v3/predictions/${predictionId}/result`,
        { headers: this.headers() },
        30_000,
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `WaveSpeed result error (${response.status}): ${errorText}`,
        );
      }

      const payload = (await response.json()) as PredictionResultResponse;
      const data = payload.data;
      if (!data) {
        throw new Error('WaveSpeed result: empty payload');
      }

      if (data.status === 'completed') {
        const audioUrl = data.outputs?.[0];
        if (!audioUrl) {
          throw new Error('WaveSpeed completed but returned no audio URL.');
        }
        return audioUrl;
      }

      if (data.status === 'failed') {
        throw new Error(
          `WaveSpeed prediction failed: ${data.error ?? 'unknown error'}`,
        );
      }

      this.logger.debug(
        `WaveSpeed prediction ${predictionId} ${data.status} (attempt ${attempt + 1}/${maxAttempts})`,
      );
    }

    throw new Error('WaveSpeed audio generation timed out.');
  }

  private async downloadAndUpload(
    sourceUrl: string,
    generationId: string,
    index: number,
  ): Promise<string> {
    const response = await this.fetchWithTimeout(sourceUrl, {}, 120_000);
    if (!response.ok) {
      throw new Error(
        `Failed to download audio from WaveSpeed (${response.status}): ${sourceUrl}`,
      );
    }
    const contentType =
      response.headers.get('content-type') ?? 'audio/mpeg';
    const ext = contentType.includes('wav')
      ? 'wav'
      : contentType.includes('ogg')
        ? 'ogg'
        : 'mp3';
    const buffer = Buffer.from(await response.arrayBuffer());
    return this.uploadsService.uploadBuffer(
      buffer,
      `generations/${generationId}`,
      `output_${index}.${ext}`,
      contentType,
    );
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    };
  }
}
