import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BaseProvider,
  GenerationInput,
  GenerationResult,
} from './base.provider';
import { UploadsService } from '../../uploads/uploads.service';

/** Maps internal resolution enum to image size values */
const IMAGE_SIZE_MAP: Record<string, string> = {
  RES_1K: '1K',
  RES_2K: '2K',
  RES_4K: '4K',
};

const IMAGE_ASPECT_RATIOS = [
  '1:1',
  '2:3',
  '3:2',
  '3:4',
  '4:3',
  '4:5',
  '5:4',
  '9:16',
  '16:9',
];

interface GeminiImageResponse {
  parts: Array<
    | { type: 'text'; text: string }
    | { type: 'image'; base64: string; mimeType: string }
  >;
}

@Injectable()
export class VertexGeminiProvider extends BaseProvider {
  private readonly logger = new Logger(VertexGeminiProvider.name);
  private readonly baseUrl: string;

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
      default:
        throw new Error(
          `Unsupported generation type for VertexGemini: ${input.type}`,
        );
    }
  }

  private async generateImage(
    input: GenerationInput,
  ): Promise<GenerationResult> {
    this.logger.log(
      `Generating image via Vertex Gemini — ${input.type} ${input.resolution}`,
    );

    const aspectRatio = this.resolveAspectRatio(input);
    const imageSize = IMAGE_SIZE_MAP[input.resolution] ?? '1K';
    const outputFormat = (input.parameters?.outputFormat as string) ?? 'png';

    const body: Record<string, unknown> = {
      prompt: input.prompt ?? '',
      model: input.parameters?.imageModel as string,
      aspect_ratio: aspectRatio,
      image_size: imageSize,
      mime_type: `image/${outputFormat}`,
      person_generation: 'ALLOW_ALL',
      temperature: 1,
      location: 'us-central1',
    };

    // For IMAGE_TO_IMAGE, include input images
    if (input.type === 'IMAGE_TO_IMAGE' && input.inputImageUrl) {
      const { base64, mimeType } = await this.downloadImageAsBase64(
        input.inputImageUrl,
      );
      body.images = [{ base64, mime_type: mimeType }];
    }

    const response = await fetch(
      `${this.baseUrl}/api/image/generate-gemini`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Vertex Gemini API error (${response.status}): ${errorText}`,
      );
    }

    const data = (await response.json()) as GeminiImageResponse;

    // Find the first image part in the response
    const imagePart = data.parts?.find((p) => p.type === 'image');
    if (!imagePart || imagePart.type !== 'image') {
      throw new Error(
        'Vertex Gemini: No image returned in response. Try a different prompt.',
      );
    }

    // Decode base64 image and upload to S3
    const buffer = Buffer.from(imagePart.base64, 'base64');
    const ext = imagePart.mimeType === 'image/jpeg' ? 'jpg' : 'png';

    const outputUrl = await this.uploadsService.uploadBuffer(
      buffer,
      `generations/${input.id}`,
      `output.${ext}`,
      imagePart.mimeType,
    );

    this.logger.log(`Image uploaded to S3: ${outputUrl}`);

    return {
      outputUrl,
      modelUsed: 'gemini-3-pro-image-preview',
    };
  }

  private resolveAspectRatio(input: GenerationInput): string {
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
}
