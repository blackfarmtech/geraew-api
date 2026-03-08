import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseProvider, GenerationInput, GenerationResult } from './base.provider';
import { UploadsService } from '../../uploads/uploads.service';

interface VideoGenerateResponse {
  operationName: string;
}

interface VideoStatusResponse {
  operationName: string;
  done: boolean;
  videos?: Array<{
    base64?: string;
    gcsUri?: string;
    mimeType: string;
  }>;
  error?: {
    code: number;
    message: string;
  };
}

interface ImageGenerateResponse {
  imageData: string;
  mimeType: string;
  text?: string;
}

/** Maps internal resolution enum to API resolution values for video */
const VIDEO_RESOLUTION_MAP: Record<string, string> = {
  RES_720P: '720p',
  RES_1080P: '1080p',
  RES_4K: '4k',
};

/** Maps internal resolution enum to API image size values */
const IMAGE_SIZE_MAP: Record<string, string> = {
  RES_1K: '1K',
  RES_2K: '2K',
  RES_4K: '4K',
};

const VIDEO_ASPECT_RATIOS = ['16:9', '9:16'];
const IMAGE_ASPECT_RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9'];

@Injectable()
export class GeminiMediaProvider extends BaseProvider {
  private readonly logger = new Logger(GeminiMediaProvider.name);
  private readonly baseUrl: string;

  private static readonly POLL_INTERVAL_MS = 10_000;
  private static readonly MAX_POLL_ATTEMPTS = 40; // ~6.5 min max

  constructor(
    private readonly configService: ConfigService,
    private readonly uploadsService: UploadsService,
  ) {
    super();
    this.baseUrl = this.configService.get<string>(
      'GEMINI_MEDIA_BASE_URL',
      'http://localhost:3001',
    );
  }

  async generate(input: GenerationInput): Promise<GenerationResult> {
    switch (input.type) {
      case 'TEXT_TO_IMAGE':
      case 'IMAGE_TO_IMAGE':
        return this.generateImage(input);
      case 'TEXT_TO_VIDEO':
        return this.generateTextToVideo(input);
      case 'IMAGE_TO_VIDEO':
        return this.generateImageToVideo(input);
      default:
        throw new Error(`Unsupported generation type for GeminiMedia: ${input.type}`);
    }
  }

  // ─── IMAGE (Synchronous) ───────────────────────────────────────────

  private async generateImage(input: GenerationInput): Promise<GenerationResult> {
    this.logger.log(`Generating image — ${input.type} ${input.resolution}`);

    const aspectRatio = this.resolveImageAspectRatio(input);
    const imageSize = IMAGE_SIZE_MAP[input.resolution] ?? '1K';



    const body: Record<string, unknown> = {
      prompt: input.prompt ?? '',
      aspectRatio,
      imageSize,
      model: input.parameters?.imageModel as string,
    };

    // If there's an input image, it's an edit (IMAGE_TO_IMAGE)
    if (input.type === 'IMAGE_TO_IMAGE' && input.inputImageUrl) {
      const { base64, mimeType } = await this.downloadImageAsBase64(input.inputImageUrl);
      body.imageBase64 = base64;
      body.imageMimeType = mimeType;
    }

    const response = await fetch(`${this.baseUrl}/api/images/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`GeminiMedia image API error (${response.status}): ${errorBody}`);
    }

    const data = (await response.json()) as ImageGenerateResponse;

    // Decode base64 image and upload to S3
    const buffer = Buffer.from(data.imageData, 'base64');
    const ext = data.mimeType === 'image/jpeg' ? 'jpg' : 'png';

    const outputUrl = await this.uploadsService.uploadBuffer(
      buffer,
      `generations/${input.id}`,
      `output.${ext}`,
      data.mimeType,
    );

    this.logger.log(`Image uploaded to S3: ${outputUrl}`);

    return {
      outputUrl,
      modelUsed: 'gemini-media',
    };
  }

  // ─── VIDEO — Text-to-Video (Asynchronous) ─────────────────────────

  private async generateTextToVideo(input: GenerationInput): Promise<GenerationResult> {
    const referenceImageUrls = input.parameters?.referenceImageUrls as string[] | undefined;

    this.logger.log(
      `Generating text-to-video — ${input.resolution} ${input.durationSeconds}s` +
      (referenceImageUrls?.length ? ` with ${referenceImageUrls.length} reference(s)` : ''),
    );

    const body: Record<string, unknown> = {
      prompt: input.prompt ?? '',
      aspect_ratio: this.resolveVideoAspectRatio(input),
      resolution: VIDEO_RESOLUTION_MAP[input.resolution] ?? '720p',
      duration_seconds: input.durationSeconds ?? 8,
      person_generation: 'allow_all',
      generate_audio: input.hasAudio,
    };

    if (input.negativePrompt) {
      body.negative_prompt = input.negativePrompt;
    }

    // Reference images (asset) — cannot coexist with image_base64
    if (referenceImageUrls?.length) {
      const referenceImages = await Promise.all(
        referenceImageUrls.map(async (url) => {
          const { base64, mimeType } = await this.downloadImageAsBase64(url);
          return { base64, mime_type: mimeType, reference_type: 'asset' };
        }),
      );
      body.reference_images = referenceImages;
    }

    const operationName = await this.submitVideoGeneration(body);
    return this.pollAndUploadVideo(operationName, input.id);
  }

  // ─── VIDEO — Image-to-Video (Asynchronous) ────────────────────────

  private async generateImageToVideo(input: GenerationInput): Promise<GenerationResult> {
    this.logger.log(
      `Generating image-to-video — ${input.resolution} ${input.durationSeconds}s`,
    );

    if (!input.inputImageUrl) {
      throw new Error('inputImageUrl is required for IMAGE_TO_VIDEO');
    }

    const { base64, mimeType } = await this.downloadImageAsBase64(input.inputImageUrl);

    const body: Record<string, unknown> = {
      prompt: input.prompt ?? '',
      image_base64: base64,
      image_mime_type: mimeType,
      aspect_ratio: this.resolveVideoAspectRatio(input),
      resolution: VIDEO_RESOLUTION_MAP[input.resolution] ?? '720p',
      duration_seconds: input.durationSeconds ?? 8,
      person_generation: 'allow_all',
      generate_audio: input.hasAudio,
    };

    if (input.negativePrompt) {
      body.negative_prompt = input.negativePrompt;
    }

    // Last frame support
    const lastFrameUrl = input.parameters?.lastFrameUrl as string | undefined;
    if (lastFrameUrl) {
      const lastFrame = await this.downloadImageAsBase64(lastFrameUrl);
      body.last_frame_base64 = lastFrame.base64;
      body.last_frame_mime_type = lastFrame.mimeType;
    }

    const operationName = await this.submitVideoGeneration(body);
    return this.pollAndUploadVideo(operationName, input.id);
  }

  // ─── Video helpers ─────────────────────────────────────────────────

  private async submitVideoGeneration(
    body: Record<string, unknown>,
  ): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/video/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`GeminiMedia video API error (${response.status}): ${errorBody}`);
    }

    const data = (await response.json()) as VideoGenerateResponse;

    if (!data.operationName) {
      throw new Error('GeminiMedia video API returned no operation name');
    }

    this.logger.log(`Video operation submitted: ${data.operationName}`);
    return data.operationName;
  }

  private async pollAndUploadVideo(
    operationName: string,
    generationId: string,
  ): Promise<GenerationResult> {
    const videoData = await this.pollVideoStatus(operationName);

    if (videoData.base64) {
      // Upload base64 video to S3
      const buffer = Buffer.from(videoData.base64, 'base64');
      const ext = videoData.mimeType === 'video/webm' ? 'webm' : 'mp4';

      const outputUrl = await this.uploadsService.uploadBuffer(
        buffer,
        `generations/${generationId}`,
        `output.${ext}`,
        videoData.mimeType,
      );

      this.logger.log(`Video uploaded to S3: ${outputUrl}`);
      return { outputUrl, modelUsed: 'gemini-media' };
    }

    if (videoData.gcsUri) {
      // Download from GCS URI and upload to S3
      const outputUrl = await this.uploadsService.uploadFromUrl(
        videoData.gcsUri,
        `generations/${generationId}`,
        'output.mp4',
      );

      this.logger.log(`Video uploaded to S3 from GCS: ${outputUrl}`);
      return { outputUrl, modelUsed: 'gemini-media' };
    }

    throw new Error('Video generation completed but returned no video data');
  }

  private async pollVideoStatus(
    operationName: string,
  ): Promise<{ base64?: string; gcsUri?: string; mimeType: string }> {
    for (
      let attempt = 0;
      attempt < GeminiMediaProvider.MAX_POLL_ATTEMPTS;
      attempt++
    ) {
      await this.sleep(GeminiMediaProvider.POLL_INTERVAL_MS);

      const response = await fetch(`${this.baseUrl}/api/video/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operationName }),
      });

      if (!response.ok) {
        this.logger.warn(
          `Poll attempt ${attempt + 1} failed with status ${response.status}`,
        );
        continue;
      }

      const data = (await response.json()) as VideoStatusResponse;

      if (data.done && data.error) {
        throw new Error(
          `GeminiMedia video generation failed: [${data.error.code}] ${data.error.message}`,
        );
      }

      if (data.done && data.videos?.length) {
        this.logger.log('Video generation completed successfully');
        return data.videos[0];
      }

      if (data.done) {
        throw new Error('Video generation completed but returned no videos');
      }

      this.logger.debug(`Poll attempt ${attempt + 1}: still processing...`);
    }

    throw new Error(
      `GeminiMedia video generation timed out after ${(GeminiMediaProvider.MAX_POLL_ATTEMPTS * GeminiMediaProvider.POLL_INTERVAL_MS) / 1000}s`,
    );
  }

  // ─── Shared helpers ────────────────────────────────────────────────

  private resolveVideoAspectRatio(input: GenerationInput): string {
    const ratio = (input.parameters?.aspectRatio as string) ?? '16:9';
    return VIDEO_ASPECT_RATIOS.includes(ratio) ? ratio : '16:9';
  }

  private resolveImageAspectRatio(input: GenerationInput): string {
    const ratio = (input.parameters?.aspectRatio as string) ?? '1:1';
    return IMAGE_ASPECT_RATIOS.includes(ratio) ? ratio : '1:1';
  }

  private async downloadImageAsBase64(
    imageUrl: string,
  ): Promise<{ base64: string; mimeType: string }> {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to download image (${response.status}): ${imageUrl}`,
      );
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const mimeType = response.headers.get('content-type') ?? 'image/png';

    return {
      base64: buffer.toString('base64'),
      mimeType,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
