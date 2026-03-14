import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import * as sharp from 'sharp';
import { PresignedUrlDto } from './dto/presigned-url.dto';
import { PresignedUrlResponseDto } from './dto/presigned-url-response.dto';

/** Default signed URL expiration: 7 days (in seconds) */
const SIGNED_URL_EXPIRY = 7 * 24 * 60 * 60;

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private readonly s3Client: S3Client | null;
  private readonly bucketName: string;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>('S3_ENDPOINT');
    this.bucketName = this.configService.get<string>(
      'S3_BUCKET_NAME',
      'ai-generations',
    );

    if (endpoint) {
      this.s3Client = new S3Client({
        endpoint,
        region: this.configService.get<string>('S3_REGION', 'us-east-1'),
        credentials: {
          accessKeyId: this.configService.get<string>('S3_ACCESS_KEY', ''),
          secretAccessKey: this.configService.get<string>(
            'S3_SECRET_KEY',
            '',
          ),
        },
        forcePathStyle: true,
      });
      this.logger.log('S3 client configured');
    } else {
      this.s3Client = null;
      this.logger.warn('S3_ENDPOINT not configured — using mock URLs');
    }
  }

  async generatePresignedUrl(
    dto: PresignedUrlDto,
  ): Promise<PresignedUrlResponseDto> {
    const fileKey = `${dto.purpose}/${randomUUID()}/${dto.filename}`;

    if (!this.s3Client) {
      return {
        uploadUrl: `https://mock-s3.local/${this.bucketName}/${fileKey}?X-Amz-Expires=900`,
        fileKey,
      };
    }

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: fileKey,
      ContentType: dto.contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: 900, // 15 minutes
    });

    return { uploadUrl, fileKey };
  }

  /**
   * Downloads a file from a URL and uploads it to S3.
   * Returns a signed URL to access the file.
   */
  async uploadFromUrl(
    sourceUrl: string,
    folder: string,
    filename: string,
  ): Promise<string> {
    const fileKey = `${folder}/${randomUUID()}/${filename}`;

    if (!this.s3Client) {
      this.logger.warn('S3 not configured — returning source URL as-is');
      return sourceUrl;
    }

    // Download
    const response = await fetch(sourceUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to download file from ${sourceUrl}: ${response.status}`,
      );
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') ?? 'image/png';

    // Upload to S3
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
        Body: buffer,
        ContentType: contentType,
      }),
    );

    this.logger.log(`Uploaded ${fileKey} (${buffer.length} bytes)`);

    // Return signed URL for reading
    return this.getSignedReadUrl(fileKey);
  }

  /**
   * Uploads raw buffer to S3 and returns a signed URL.
   */
  async uploadBuffer(
    buffer: Buffer,
    folder: string,
    filename: string,
    contentType: string,
  ): Promise<string> {
    const fileKey = `${folder}/${randomUUID()}/${filename}`;

    if (!this.s3Client) {
      return `https://mock-s3.local/${this.bucketName}/${fileKey}`;
    }

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
        Body: buffer,
        ContentType: contentType,
      }),
    );

    this.logger.log(`Uploaded ${fileKey} (${buffer.length} bytes)`);
    return this.getSignedReadUrl(fileKey);
  }

  /**
   * Generates a thumbnail from an image URL, uploads it to S3 and returns its signed URL.
   */
  async generateThumbnail(
    sourceUrl: string,
    folder: string,
    filename: string,
    size = 256,
  ): Promise<string> {
    const fileKey = `${folder}/${randomUUID()}/${filename}`;

    if (!this.s3Client) {
      return `https://mock-s3.local/${this.bucketName}/${fileKey}`;
    }

    try {
      const response = await fetch(sourceUrl);
      if (!response.ok) throw new Error(`Download failed: ${response.status}`);

      const buffer = Buffer.from(await response.arrayBuffer());
      const thumbnail = await sharp(buffer)
        .resize(size, size, { fit: 'cover' })
        .jpeg({ quality: 70 })
        .toBuffer();

      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: fileKey,
          Body: thumbnail,
          ContentType: 'image/jpeg',
        }),
      );

      this.logger.log(`Thumbnail uploaded ${fileKey} (${thumbnail.length} bytes)`);
      return this.getSignedReadUrl(fileKey);
    } catch (error) {
      this.logger.warn(`Failed to generate thumbnail: ${(error as Error).message}`);
      return sourceUrl;
    }
  }

  /**
   * Same as generateThumbnail but throws on failure instead of returning sourceUrl.
   */
  async generateThumbnailDirect(
    sourceUrl: string,
    folder: string,
    filename: string,
    size = 256,
  ): Promise<string> {
    const fileKey = `${folder}/${randomUUID()}/${filename}`;

    if (!this.s3Client) {
      return `https://mock-s3.local/${this.bucketName}/${fileKey}`;
    }

    const response = await fetch(sourceUrl);
    if (!response.ok) throw new Error(`Download failed: ${response.status}`);

    const buffer = Buffer.from(await response.arrayBuffer());
    const thumbnail = await sharp(buffer)
      .resize(size, size, { fit: 'cover' })
      .jpeg({ quality: 70 })
      .toBuffer();

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
        Body: thumbnail,
        ContentType: 'image/jpeg',
      }),
    );

    this.logger.log(`Thumbnail uploaded ${fileKey} (${thumbnail.length} bytes)`);
    return this.getSignedReadUrl(fileKey);
  }

  /**
   * Generates a signed read URL for an S3 object (valid for 7 days).
   */
  async getSignedReadUrl(fileKey: string): Promise<string> {
    if (!this.s3Client) {
      return `https://mock-s3.local/${this.bucketName}/${fileKey}`;
    }

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: fileKey,
    });

    return getSignedUrl(this.s3Client, command, {
      expiresIn: SIGNED_URL_EXPIRY,
    });
  }
}
