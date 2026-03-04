import { ConfigService } from '@nestjs/config';
import { PresignedUrlDto } from './dto/presigned-url.dto';
import { PresignedUrlResponseDto } from './dto/presigned-url-response.dto';
export declare class UploadsService {
    private readonly configService;
    private readonly logger;
    private readonly s3Client;
    private readonly bucketName;
    constructor(configService: ConfigService);
    generatePresignedUrl(dto: PresignedUrlDto): Promise<PresignedUrlResponseDto>;
    uploadFromUrl(sourceUrl: string, folder: string, filename: string): Promise<string>;
    uploadBuffer(buffer: Buffer, folder: string, filename: string, contentType: string): Promise<string>;
    getSignedReadUrl(fileKey: string): Promise<string>;
}
