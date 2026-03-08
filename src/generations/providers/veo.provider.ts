import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseProvider, GenerationInput, GenerationResult } from './base.provider';
import { UploadsService } from '../../uploads/uploads.service';

interface VeoPredictResponse {
  name: string;
}

interface VeoOperationResponse {
  name: string;
  done?: boolean;
  response?: {
    '@type': string;
    raiMediaFilteredCount: number;
    videos: Array<{
      gcsUri: string;
      mimeType: string;
    }>;
  };
}

@Injectable()
export class VeoProvider extends BaseProvider {
  private readonly logger = new Logger(VeoProvider.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;

  private static readonly POLL_INTERVAL_MS = 5000;
  private static readonly MAX_POLL_ATTEMPTS = 180; // 15 minutes max

  constructor(
    private readonly configService: ConfigService,
    private readonly uploadsService: UploadsService,
  ) {
    super();
    this.apiKey = this.configService.get<string>('VEO_API_KEY', '');
    this.baseUrl = this.configService.get<string>(
      'VEO_BASE_URL',
      'https://us-central1-aiplatform.googleapis.com/v1/projects/project-da91ddc4-fae8-4fe8-928/locations/us-central1/publishers/google/models/veo-3.1-generate-preview',
    );
  }

  async generate(input: GenerationInput): Promise<GenerationResult> {
    this.logger.log(
      `Generating video with Veo 3.1 — ${input.type} ${input.resolution} ${input.durationSeconds}s audio:${input.hasAudio}`,
    );

    // 1. Build request body
    const body = await this.buildRequestBody(input);

    // 2. Submit long-running prediction
    const operationName = await this.submitPrediction(body);
    this.logger.log(`Operation submitted: ${operationName}`);

    // 3. Poll until complete
    const result = await this.pollOperation(operationName);

    // 4. Convert gs:// URI to public URL and upload to S3
    const gcsUri = result.videos[0].gcsUri;
    const publicUrl = this.gcsToPublicUrl(gcsUri);

    const outputUrl = await this.uploadsService.uploadFromUrl(
      publicUrl,
      `generations/${input.id}`,
      'output.mp4',
    );

    this.logger.log(`Video uploaded to S3: ${outputUrl}`);

    return {
      outputUrl,
      modelUsed: 'veo-3.1',
    };
  }

  private async buildRequestBody(
    input: GenerationInput,
  ): Promise<Record<string, unknown>> {
    const aspectRatio = (input.parameters?.aspectRatio as string) ?? '9:16';
    const durationSeconds = input.durationSeconds ?? 8;

    const instance: Record<string, unknown> = {
      prompt: input.prompt ?? '',
    };

    console.log({ input })

    // If there's a reference image (IMAGE_TO_VIDEO), include it as base64
    if (input.type === 'IMAGE_TO_VIDEO' && input.inputImageUrl) {
      const imageBase64 = await this.downloadImageAsBase64(input.inputImageUrl);
      instance.referenceImages = [
        {
          image: {
            bytesBase64Encoded: imageBase64,
            mimeType: 'image/jpeg',
          },
          referenceType: 'asset',
        },
      ];
    }

    console.log(instance)

    console.log({
      aspectRatio,
      sampleCount: 1,
      durationSeconds,
      storageUri: 'gs://bucketvertex3424234',
      personGeneration: 'allow_all',
      generateAudio: input.hasAudio,
      resolution: '1080p',
      seed: 0,
    },);
    return {
      instances: [instance],
      parameters: {
        aspectRatio,
        sampleCount: 1,
        durationSeconds,
        storageUri: 'gs://bucketvertex3424234',
        personGeneration: 'allow_all',
        generateAudio: input.hasAudio,
        resolution: '1080p',
        seed: 0,
      },
    };
  }


  private async submitPrediction(
    body: Record<string, unknown>,
  ): Promise<string> {
    const url = `${this.baseUrl}:predictLongRunning`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Veo API error (${response.status}): ${text}`);
    }

    const data = (await response.json()) as VeoPredictResponse;

    if (!data.name) {
      throw new Error('Veo API returned no operation name');
    }

    return data.name;
  }

  private async pollOperation(
    operationName: string,
  ): Promise<{ videos: Array<{ gcsUri: string; mimeType: string }> }> {
    const url = `${this.baseUrl}:fetchPredictOperation`;

    for (
      let attempt = 0;
      attempt < VeoProvider.MAX_POLL_ATTEMPTS;
      attempt++
    ) {
      await this.sleep(VeoProvider.POLL_INTERVAL_MS);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ operationName }),
      });

      if (!response.ok) {
        this.logger.warn(
          `Poll attempt ${attempt + 1} failed with status ${response.status}`,
        );
        continue;
      }

      const data = (await response.json()) as VeoOperationResponse;

      if (data.done && data.response) {
        this.logger.log(`Operation completed successfully`);

        if (!data.response.videos || data.response.videos.length === 0) {
          throw new Error(
            `Veo generation completed but returned no videos (filtered: ${data.response.raiMediaFilteredCount})`,
          );
        }

        return { videos: data.response.videos };
      }

      // Not done yet — continue polling
      this.logger.debug(
        `Poll attempt ${attempt + 1}: still processing...`,
      );
    }

    throw new Error(
      `Veo generation timed out after ${(VeoProvider.MAX_POLL_ATTEMPTS * VeoProvider.POLL_INTERVAL_MS) / 1000}s`,
    );
  }

  /**
   * Converts a GCS URI (gs://bucket/path) to a public HTTPS URL.
   */
  private gcsToPublicUrl(gcsUri: string): string {
    // gs://bucket/path → https://storage.googleapis.com/bucket/path
    const withoutPrefix = gcsUri.replace('gs://', '');
    return `https://storage.googleapis.com/${withoutPrefix}`;
  }

  /**
   * Downloads an image from a URL and returns its content as base64.
   */
  private async downloadImageAsBase64(imageUrl: string): Promise<string> {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to download reference image (${response.status}): ${imageUrl}`,
      );
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer.toString('base64');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
