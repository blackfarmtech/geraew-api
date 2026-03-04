import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseProvider, GenerationInput, GenerationResult } from './base.provider';
import { UploadsService } from '../../uploads/uploads.service';

interface NanoBananaGenerateResponse {
  code: number;
  msg: string;
  data: {
    taskId: string;
  };
}

interface NanoBananaTaskResponse {
  code: number;
  msg: string;
  data: {
    taskId: string;
    response: {
      originImageUrl: string;
      resultImageUrl: string;
    };
    successFlag: number; // 0=GENERATING, 1=SUCCESS, 2=CREATE_TASK_FAILED, 3=GENERATE_FAILED
    errorCode: number;
    errorMessage: string;
  };
}

/** Maps internal resolution enum to NanoBanana API resolution */
const RESOLUTION_MAP: Record<string, string> = {
  RES_1K: '1K',
  RES_2K: '2K',
  RES_4K: '4K',
};

@Injectable()
export class NanoBananaProvider extends BaseProvider {
  private readonly logger = new Logger(NanoBananaProvider.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;

  private static readonly POLL_INTERVAL_MS = 3000;
  private static readonly MAX_POLL_ATTEMPTS = 120; // 6 minutes max

  constructor(
    private readonly configService: ConfigService,
    private readonly uploadsService: UploadsService,
  ) {
    super();
    this.apiKey = this.configService.get<string>('NANO_BANANA_API_KEY', '');
    this.baseUrl = this.configService.get<string>(
      'NANO_BANANA_BASE_URL',
      'https://api.nanobananaapi.ai',
    );
  }

  async generate(input: GenerationInput): Promise<GenerationResult> {
    this.logger.log(
      `Generating image with Nano Banana 2 — ${input.type} ${input.resolution}`,
    );

    // 1. Submit generation task
    const taskId = await this.submitTask(input);
    this.logger.log(`Task submitted: ${taskId}`);

    // 2. Poll until complete
    const result = await this.pollTaskResult(taskId);

    // 3. Download from NanoBanana and upload to our S3
    const outputFormat = (input.parameters?.outputFormat as string) ?? 'jpg';
    const outputUrl = await this.uploadsService.uploadFromUrl(
      result.resultImageUrl,
      `generations/${input.id}`,
      `output.${outputFormat}`,
    );

    this.logger.log(`Image uploaded to S3: ${outputUrl}`);

    return {
      outputUrl,
      modelUsed: 'nano-banana-2',
    };
  }

  private async submitTask(input: GenerationInput): Promise<string> {
    const imageUrls: string[] = [];
    if (input.type === 'IMAGE_TO_IMAGE' && input.inputImageUrl) {
      imageUrls.push(input.inputImageUrl);
    }

    const body: Record<string, unknown> = {
      prompt: input.prompt ?? '',
      imageUrls,
      aspectRatio: (input.parameters?.aspectRatio as string) ?? 'auto',
      resolution: RESOLUTION_MAP[input.resolution] ?? '1K',
      googleSearch: (input.parameters?.googleSearch as boolean) ?? false,
      outputFormat: (input.parameters?.outputFormat as string) ?? 'jpg',
      callBackUrl: 'https://noop.example.com/callback',
    };

    const response = await fetch(
      `${this.baseUrl}/api/v1/nanobanana/generate-2`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`NanoBanana API error (${response.status}): ${text}`);
    }

    const data = (await response.json()) as NanoBananaGenerateResponse;

    if (data.code !== 200) {
      throw new Error(`NanoBanana API error: ${data.msg}`);
    }

    return data.data.taskId;
  }

  private async pollTaskResult(
    taskId: string,
  ): Promise<{ originImageUrl: string; resultImageUrl: string }> {
    for (
      let attempt = 0;
      attempt < NanoBananaProvider.MAX_POLL_ATTEMPTS;
      attempt++
    ) {
      await this.sleep(NanoBananaProvider.POLL_INTERVAL_MS);

      const response = await fetch(
        `${this.baseUrl}/api/v1/nanobanana/record-info?taskId=${encodeURIComponent(taskId)}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        },
      );

      if (!response.ok) {
        this.logger.warn(
          `Poll attempt ${attempt + 1} failed with status ${response.status}`,
        );
        continue;
      }

      const data = (await response.json()) as NanoBananaTaskResponse;

      if (data.code !== 200) {
        this.logger.warn(`Poll attempt ${attempt + 1}: ${data.msg}`);
        continue;
      }

      const { successFlag } = data.data;

      if (successFlag === 1) {
        this.logger.log(`Task ${taskId} completed successfully`);
        return data.data.response;
      }

      if (successFlag === 2) {
        throw new Error(
          `NanoBanana task creation failed: ${data.data.errorMessage || 'CREATE_TASK_FAILED'}`,
        );
      }

      if (successFlag === 3) {
        throw new Error(
          `NanoBanana generation failed: ${data.data.errorMessage || 'GENERATE_FAILED'}`,
        );
      }

      // successFlag === 0 → still generating, continue polling
    }

    throw new Error(
      `NanoBanana generation timed out after ${(NanoBananaProvider.MAX_POLL_ATTEMPTS * NanoBananaProvider.POLL_INTERVAL_MS) / 1000}s`,
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
