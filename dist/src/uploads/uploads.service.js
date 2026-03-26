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
const ffmpeg = require("fluent-ffmpeg");
const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");
const fs = require("fs");
const path = require("path");
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
let UploadsService = UploadsService_1 = class UploadsService {
    configService;
    logger = new common_1.Logger(UploadsService_1.name);
    s3Client;
    bucketName;
    publicUrlBase;
    constructor(configService) {
        this.configService = configService;
        const endpoint = this.configService.get('S3_ENDPOINT');
        this.bucketName = this.configService.get('S3_BUCKET_NAME', 'ai-generations');
        this.publicUrlBase = (this.configService.get('S3_PUBLIC_URL', '') || '').replace(/\/$/, '');
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
    getPublicUrl(fileKey) {
        if (!this.publicUrlBase) {
            return `https://mock-s3.local/${this.bucketName}/${fileKey}`;
        }
        return `${this.publicUrlBase}/${fileKey}`;
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
        return this.getPublicUrl(fileKey);
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
        return this.getPublicUrl(fileKey);
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
                .webp({ quality: 70 })
                .toBuffer();
            await this.s3Client.send(new client_s3_1.PutObjectCommand({
                Bucket: this.bucketName,
                Key: fileKey,
                Body: thumbnail,
                ContentType: 'image/webp',
            }));
            this.logger.log(`Thumbnail uploaded ${fileKey} (${thumbnail.length} bytes)`);
            return this.getPublicUrl(fileKey);
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
            .webp({ quality: 70 })
            .toBuffer();
        await this.s3Client.send(new client_s3_1.PutObjectCommand({
            Bucket: this.bucketName,
            Key: fileKey,
            Body: thumbnail,
            ContentType: 'image/webp',
        }));
        this.logger.log(`Thumbnail uploaded ${fileKey} (${thumbnail.length} bytes)`);
        return this.getPublicUrl(fileKey);
    }
    async generateVideoThumbnail(videoUrl, folder, filename, size = 256) {
        const fileKey = `${folder}/${(0, crypto_1.randomUUID)()}/${filename}`;
        if (!this.s3Client) {
            return `https://mock-s3.local/${this.bucketName}/${fileKey}`;
        }
        const tempDir = path.join('/tmp', `vidthumb-${(0, crypto_1.randomUUID)()}`);
        fs.mkdirSync(tempDir, { recursive: true });
        const videoPath = path.join(tempDir, 'input.mp4');
        const framePath = path.join(tempDir, 'frame.jpg');
        try {
            const response = await fetch(videoUrl);
            if (!response.ok) {
                throw new Error(`Failed to download video: ${response.status}`);
            }
            const videoBuffer = Buffer.from(await response.arrayBuffer());
            fs.writeFileSync(videoPath, videoBuffer);
            await new Promise((resolve, reject) => {
                ffmpeg(videoPath)
                    .seekInput(0)
                    .frames(1)
                    .output(framePath)
                    .on('end', () => resolve())
                    .on('error', (err) => reject(err))
                    .run();
            });
            const frameBuffer = fs.readFileSync(framePath);
            const thumbnail = await sharp(frameBuffer)
                .resize(size, size, { fit: 'cover' })
                .webp({ quality: 70 })
                .toBuffer();
            await this.s3Client.send(new client_s3_1.PutObjectCommand({
                Bucket: this.bucketName,
                Key: fileKey,
                Body: thumbnail,
                ContentType: 'image/webp',
            }));
            this.logger.log(`Video thumbnail uploaded ${fileKey} (${thumbnail.length} bytes)`);
            return this.getPublicUrl(fileKey);
        }
        catch (error) {
            this.logger.warn(`Failed to generate video thumbnail: ${error.message}`);
            throw error;
        }
        finally {
            try {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
            catch { }
        }
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
        }));
        this.logger.log(`Uploaded (public) ${fileKey} (${buffer.length} bytes)`);
        const publicUrl = this.getPublicUrl(fileKey);
        return { publicUrl, signedUrl: publicUrl };
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
            expiresIn: 7 * 24 * 60 * 60,
        });
    }
    async deleteByPrefix(prefix) {
        if (!this.s3Client) {
            this.logger.warn('S3 not configured — skipping deleteByPrefix');
            return 0;
        }
        let totalDeleted = 0;
        let continuationToken;
        do {
            const listResult = await this.s3Client.send(new client_s3_1.ListObjectsV2Command({
                Bucket: this.bucketName,
                Prefix: prefix,
                ContinuationToken: continuationToken,
            }));
            const objects = listResult.Contents;
            if (!objects?.length)
                break;
            await this.s3Client.send(new client_s3_1.DeleteObjectsCommand({
                Bucket: this.bucketName,
                Delete: { Objects: objects.map((o) => ({ Key: o.Key })) },
            }));
            totalDeleted += objects.length;
            continuationToken = listResult.IsTruncated
                ? listResult.NextContinuationToken
                : undefined;
        } while (continuationToken);
        if (totalDeleted > 0) {
            this.logger.log(`Deleted ${totalDeleted} objects under prefix "${prefix}"`);
        }
        return totalDeleted;
    }
    async generateBlurDataUrl(imageBuffer) {
        const tiny = await sharp(imageBuffer)
            .resize(16, 16, { fit: 'cover' })
            .blur(2)
            .webp({ quality: 20 })
            .toBuffer();
        return `data:image/webp;base64,${tiny.toString('base64')}`;
    }
};
exports.UploadsService = UploadsService;
exports.UploadsService = UploadsService = UploadsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], UploadsService);
//# sourceMappingURL=uploads.service.js.map