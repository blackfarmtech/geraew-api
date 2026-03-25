import { ConfigService } from '@nestjs/config';
import { PresignedUrlDto } from './dto/presigned-url.dto';
import { PresignedUrlResponseDto } from './dto/presigned-url-response.dto';
export declare class UploadsService {
    private readonly configService;
    private readonly logger;
    private readonly s3Client;
    private readonly bucketName;
    private readonly publicUrlBase;
    constructor(configService: ConfigService);
    getPublicUrl(fileKey: string): string;
    generatePresignedUrl(dto: PresignedUrlDto): Promise<PresignedUrlResponseDto>;
    uploadFromUrl(sourceUrl: string, folder: string, filename: string): Promise<string>;
    uploadBuffer(buffer: Buffer, folder: string, filename: string, contentType: string): Promise<string>;
    generateThumbnail(sourceUrl: string, folder: string, filename: string, size?: number): Promise<string>;
    generateThumbnailDirect(sourceUrl: string, folder: string, filename: string, size?: number): Promise<string>;
    generateVideoThumbnail(videoUrl: string, folder: string, filename: string, size?: number): Promise<string>;
    uploadBufferPublic(buffer: Buffer, folder: string, filename: string, contentType: string): Promise<{
        publicUrl: string;
        signedUrl: string;
    }>;
    getSignedReadUrl(fileKey: string): Promise<string>;
    deleteByPrefix(prefix: string): Promise<number>;
    generateBlurDataUrl(imageBuffer: Buffer): Promise<string>;
}
