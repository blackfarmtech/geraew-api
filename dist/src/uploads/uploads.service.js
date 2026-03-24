"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var UploadsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const crypto_1 = require("crypto");
const sharp = require("sharp");
const SIGNED_URL_EXPIRY = 7 * 24 * 60 * 60;
let UploadsService = UploadsService_1 = class UploadsService {
    configService;
    logger = new common_1.Logger(UploadsService_1.name);
    s3Client;
    bucketName;
    constructor(configService) {
        this.configService = configService;
        const endpoint = this.configService.get('S3_ENDPOINT');
        this.bucketName = this.configService.get('S3_BUCKET_NAME', 'ai-generations');
        if (endpoint) {
            this.s3Client = new client_s3_1.S3Client({
                endpoint,
                region: this.configService.get('S3_REGION', 'us-east-1'),
                credentials: {
                    accessKeyId: this.configService.get('S3_ACCESS_KEY', ''),
                    secretAccessKey: this.configService.get('S3_SECRET_KEY', ''),
                },
                forcePathStyle: true,
            });
            this.logger.log('S3 client configured');
        }
        else {
            this.s3Client = null;
            this.logger.warn('S3_ENDPOINT not configured — using mock URLs');
        }
    }
    async generatePresignedUrl(dto) {
        const fileKey = `${dto.purpose}/${(0, crypto_1.randomUUID)()}/${dto.filename}`;
        if (!this.s3Client) {
            return {
                uploadUrl: `https://mock-s3.local/${this.bucketName}/${fileKey}?X-Amz-Expires=900`,
                fileKey,
            };
        }
        const command = new client_s3_1.PutObjectCommand({
            Bucket: this.bucketName,
            Key: fileKey,
            ContentType: dto.contentType,
        });
        const uploadUrl = await (0, s3_request_presigner_1.getSignedUrl)(this.s3Client, command, {
            expiresIn: 900,
        });
        return { uploadUrl, fileKey };
    }
    async uploadFromUrl(sourceUrl, folder, filename) {
        const fileKey = `${folder}/${(0, crypto_1.randomUUID)()}/${filename}`;
        if (!this.s3Client) {
            this.logger.warn('S3 not configured — returning source URL as-is');
            return sourceUrl;
        }
        const response = await fetch(sourceUrl);
        if (!response.ok) {
            throw new Error(`Failed to download file from ${sourceUrl}: ${response.status}`);
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        const contentType = response.headers.get('content-type') ?? 'image/png';
        await this.s3Client.send(new client_s3_1.PutObjectCommand({
            Bucket: this.bucketName,
            Key: fileKey,
            Body: buffer,
            ContentType: contentType,
        }));
        this.logger.log(`Uploaded ${fileKey} (${buffer.length} bytes)`);
        return this.getSignedReadUrl(fileKey);
    }
    async uploadBuffer(buffer, folder, filename, contentType) {
        const fileKey = `${folder}/${(0, crypto_1.randomUUID)()}/${filename}`;
        if (!this.s3Client) {
            return `https://mock-s3.local/${this.bucketName}/${fileKey}`;
        }
        await this.s3Client.send(new client_s3_1.PutObjectCommand({
            Bucket: this.bucketName,
            Key: fileKey,
            Body: buffer,
            ContentType: contentType,
        }));
        this.logger.log(`Uploaded ${fileKey} (${buffer.length} bytes)`);
        return this.getSignedReadUrl(fileKey);
    }
    async generateThumbnail(sourceUrl, folder, filename, size = 256) {
        const fileKey = `${folder}/${(0, crypto_1.randomUUID)()}/${filename}`;
        if (!this.s3Client) {
            return `https://mock-s3.local/${this.bucketName}/${fileKey}`;
        }
        try {
            const response = await fetch(sourceUrl);
            if (!response.ok)
                throw new Error(`Download failed: ${response.status}`);
            const buffer = Buffer.from(await response.arrayBuffer());
            const thumbnail = await sharp(buffer)
                .resize(size, size, { fit: 'cover' })
                .jpeg({ quality: 70 })
                .toBuffer();
            await this.s3Client.send(new client_s3_1.PutObjectCommand({
                Bucket: this.bucketName,
                Key: fileKey,
                Body: thumbnail,
                ContentType: 'image/jpeg',
            }));
            this.logger.log(`Thumbnail uploaded ${fileKey} (${thumbnail.length} bytes)`);
            return this.getSignedReadUrl(fileKey);
        }
        catch (error) {
            this.logger.warn(`Failed to generate thumbnail: ${error.message}`);
            return sourceUrl;
        }
    }
    async generateThumbnailDirect(sourceUrl, folder, filename, size = 256) {
        const fileKey = `${folder}/${(0, crypto_1.randomUUID)()}/${filename}`;
        if (!this.s3Client) {
            return `https://mock-s3.local/${this.bucketName}/${fileKey}`;
        }
        const response = await fetch(sourceUrl);
        if (!response.ok)
            throw new Error(`Download failed: ${response.status}`);
        const buffer = Buffer.from(await response.arrayBuffer());
        const thumbnail = await sharp(buffer)
            .resize(size, size, { fit: 'cover' })
            .jpeg({ quality: 70 })
            .toBuffer();
        await this.s3Client.send(new client_s3_1.PutObjectCommand({
            Bucket: this.bucketName,
            Key: fileKey,
            Body: thumbnail,
            ContentType: 'image/jpeg',
        }));
        this.logger.log(`Thumbnail uploaded ${fileKey} (${thumbnail.length} bytes)`);
        return this.getSignedReadUrl(fileKey);
    }
    async uploadBufferPublic(buffer, folder, filename, contentType) {
        const fileKey = `${folder}/${(0, crypto_1.randomUUID)()}/${filename}`;
        if (!this.s3Client) {
            const mockUrl = `https://mock-s3.local/${this.bucketName}/${fileKey}`;
            return { publicUrl: mockUrl, signedUrl: mockUrl };
        }
        await this.s3Client.send(new client_s3_1.PutObjectCommand({
            Bucket: this.bucketName,
            Key: fileKey,
            Body: buffer,
            ContentType: contentType,
            ACL: 'public-read',
        }));
        this.logger.log(`Uploaded (public) ${fileKey} (${buffer.length} bytes)`);
        const signedUrl = await this.getSignedReadUrl(fileKey);
        const publicBase = this.configService.get('S3_PUBLIC_URL');
        const publicUrl = publicBase
            ? `${publicBase.replace(/\/$/, '')}/${fileKey}`
            : signedUrl;
        return { publicUrl, signedUrl };
    }
    async getSignedReadUrl(fileKey) {
        if (!this.s3Client) {
            return `https://mock-s3.local/${this.bucketName}/${fileKey}`;
        }
        const command = new client_s3_1.GetObjectCommand({
            Bucket: this.bucketName,
            Key: fileKey,
        });
        return (0, s3_request_presigner_1.getSignedUrl)(this.s3Client, command, {
            expiresIn: SIGNED_URL_EXPIRY,
        });
    }
};
exports.UploadsService = UploadsService;
exports.UploadsService = UploadsService = UploadsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], UploadsService);
//# sourceMappingURL=uploads.service.js.map