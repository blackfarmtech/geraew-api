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
var GeraewProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeraewProvider = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const uploads_service_1 = require("../../uploads/uploads.service");
const IMAGE_SIZE_MAP = {
    RES_1K: '1K',
    RES_2K: '2K',
    RES_4K: '4K',
};
const VIDEO_RESOLUTION_MAP = {
    RES_720P: '720p',
    RES_1080P: '1080p',
    RES_4K: '4K',
};
let GeraewProvider = GeraewProvider_1 = class GeraewProvider {
    configService;
    uploadsService;
    logger = new common_1.Logger(GeraewProvider_1.name);
    baseUrl;
    apiKey;
    constructor(configService, uploadsService) {
        this.configService = configService;
        this.uploadsService = uploadsService;
        this.baseUrl = this.configService.get('GERAEW_PROVIDER_URL', 'http://localhost:3001');
        this.apiKey = this.configService.get('GERAEW_API_KEY', '');
    }
    async generateImage(input) {
        this.logger.log(`Generating image — resolution ${input.resolution}`);
        const imageSize = IMAGE_SIZE_MAP[input.resolution] ?? '1K';
        const body = {
            prompt: input.prompt,
            model: input.model,
            aspect_ratio: input.aspectRatio ?? '1:1',
            image_size: imageSize,
            mime_type: input.mimeType ?? 'image/png',
        };
        if (input.images?.length) {
            body.images = input.images.map((img) => ({
                base64: img.base64,
                mime_type: img.mimeType,
            }));
        }
        const url = `${this.baseUrl}/api/image/generate-gemini`;
        this.logger.log(`[IMAGE] POST ${url}`);
        this.logger.log(`[IMAGE] Body: ${JSON.stringify({ ...body, images: body.images ? `[${body.images.length} image(s)]` : undefined })}`);
        let response;
        try {
            response = await this.fetchWithTimeout(url, {
                method: 'POST',
                headers: this.headers(),
                body: JSON.stringify(body),
            }, 120_000);
        }
        catch (error) {
            this.logger.error(`[IMAGE] Fetch failed to ${url}: ${error.message}`, error.cause ? JSON.stringify(error.cause) : undefined);
            throw error;
        }
        this.logger.log(`[IMAGE] Response status: ${response.status}`);
        if (!response.ok) {
            const errorText = await response.text();
            this.logger.error(`[IMAGE] Error response: ${errorText}`);
            throw new Error(`Image API error (${response.status}): ${errorText}`);
        }
        const data = (await response.json());
        const imageParts = data.parts?.filter((p) => p.type === 'image') ?? [];
        if (!imageParts.length) {
            throw new Error('No image returned in response. Try a different prompt.');
        }
        const outputUrls = [];
        for (let i = 0; i < imageParts.length; i++) {
            const imagePart = imageParts[i];
            if (imagePart.type !== 'image')
                continue;
            const buffer = Buffer.from(imagePart.base64, 'base64');
            const ext = imagePart.mimeType === 'image/jpeg' ? 'jpg' : 'png';
            const outputUrl = await this.uploadsService.uploadBuffer(buffer, `generations/${input.id}`, `output_${i}.${ext}`, imagePart.mimeType);
            outputUrls.push(outputUrl);
        }
        this.logger.log(`${outputUrls.length} image(s) uploaded to S3`);
        return { outputUrls, modelUsed: input.model };
    }
    async generateTextToVideo(input) {
        this.logger.log(`Generating text-to-video — resolution ${input.resolution}`);
        const body = this.buildVideoBody(input);
        return this.startAndPollVideo('/api/video/generate-text-to-video', body, input.id, input.model);
    }
    async generateImageToVideo(input) {
        this.logger.log(`Generating image-to-video — resolution ${input.resolution}`);
        const body = {
            ...this.buildVideoBody(input),
            first_frame: input.firstFrame,
            first_frame_mime_type: input.firstFrameMimeType,
        };
        if (input.lastFrame) {
            body.last_frame = input.lastFrame;
            body.last_frame_mime_type = input.lastFrameMimeType;
        }
        return this.startAndPollVideo('/api/video/generate-image-to-video', body, input.id, input.model);
    }
    async generateVideoWithReferences(input) {
        this.logger.log(`Generating video with references — resolution ${input.resolution}`);
        const body = {
            ...this.buildVideoBody(input),
            reference_images: input.referenceImages.map((ref) => ({
                base64: ref.base64,
                mime_type: ref.mimeType,
                reference_type: ref.referenceType,
            })),
        };
        return this.startAndPollVideo('/api/video/generate-references', body, input.id, input.model);
    }
    buildVideoBody(input) {
        const resolution = VIDEO_RESOLUTION_MAP[input.resolution] ?? '1080p';
        return {
            prompt: input.prompt,
            model: input.model,
            duration_seconds: input.durationSeconds,
            aspect_ratio: input.aspectRatio,
            resolution,
            generate_audio: input.generateAudio,
            sample_count: input.sampleCount,
            negative_prompt: input.negativePrompt,
        };
    }
    async startAndPollVideo(route, body, generationId, model) {
        const url = `${this.baseUrl}${route}`;
        this.logger.log(`[VIDEO] POST ${url}`);
        this.logger.log(`[VIDEO] Body: ${JSON.stringify(body)}`);
        let startResponse;
        try {
            startResponse = await this.fetchWithTimeout(url, {
                method: 'POST',
                headers: this.headers(),
                body: JSON.stringify(body),
            }, 60_000);
        }
        catch (error) {
            this.logger.error(`[VIDEO] Fetch failed to ${url}: ${error.message}`, error.cause ? JSON.stringify(error.cause) : undefined);
            throw error;
        }
        this.logger.log(`[VIDEO] Response status: ${startResponse.status}`);
        if (!startResponse.ok) {
            const errorText = await startResponse.text();
            this.logger.error(`[VIDEO] Error response: ${errorText}`);
            throw new Error(`Video API error (${startResponse.status}): ${errorText}`);
        }
        const { operationName } = (await startResponse.json());
        this.logger.log(`[VIDEO] Generation started: ${operationName}`);
        const videos = await this.pollVideoStatus(operationName);
        const outputUrls = [];
        for (let i = 0; i < videos.length; i++) {
            const video = videos[i];
            let videoBuffer;
            if (video.base64) {
                videoBuffer = Buffer.from(video.base64, 'base64');
            }
            else if (video.gcsUri) {
                videoBuffer = await this.downloadFromGcs(video.gcsUri);
            }
            else {
                continue;
            }
            const mimeType = video.mimeType ?? 'video/mp4';
            const outputUrl = await this.uploadsService.uploadBuffer(videoBuffer, `generations/${generationId}`, `output_${i}.mp4`, mimeType);
            outputUrls.push(outputUrl);
        }
        if (!outputUrls.length) {
            throw new Error('No video data returned in response.');
        }
        this.logger.log(`${outputUrls.length} video(s) uploaded to S3`);
        return { outputUrls, modelUsed: model };
    }
    async pollVideoStatus(operationName, maxAttempts = 60, intervalMs = 10_000) {
        const maxNetworkRetries = 5;
        let networkFailures = 0;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            if (attempt > 0) {
                await new Promise((resolve) => setTimeout(resolve, intervalMs));
            }
            const statusUrl = `${this.baseUrl}/api/video/status`;
            let response;
            try {
                response = await this.fetchWithTimeout(statusUrl, {
                    method: 'POST',
                    headers: this.headers(),
                    body: JSON.stringify({ operationName }),
                }, 30_000);
                networkFailures = 0;
            }
            catch (error) {
                networkFailures++;
                this.logger.warn(`[VIDEO POLL] Fetch failed (${networkFailures}/${maxNetworkRetries}) to ${statusUrl}: ${error.message}`, error.cause ? JSON.stringify(error.cause) : undefined);
                if (networkFailures >= maxNetworkRetries) {
                    this.logger.error(`[VIDEO POLL] Max network retries exceeded`);
                    throw error;
                }
                continue;
            }
            if (!response.ok) {
                const errorText = await response.text();
                this.logger.error(`[VIDEO POLL] Error response (${response.status}): ${errorText}`);
                throw new Error(`Video status check error (${response.status}): ${errorText}`);
            }
            const data = (await response.json());
            if (!data.done) {
                this.logger.debug(`Video still processing... (attempt ${attempt + 1}/${maxAttempts})`);
                continue;
            }
            if (data.error) {
                throw new Error(`Video generation failed: ${JSON.stringify(data.error)}`);
            }
            if (data.videos?.length) {
                return data.videos;
            }
            throw new Error('Video generation completed but no video data returned.');
        }
        throw new Error('Video generation timed out.');
    }
    async downloadFromGcs(gcsUri) {
        const httpsUrl = gcsUri.replace('gs://', 'https://storage.googleapis.com/');
        const response = await this.fetchWithTimeout(httpsUrl, {}, 120_000);
        if (!response.ok) {
            throw new Error(`Failed to download video from GCS (${response.status}): ${httpsUrl}`);
        }
        return Buffer.from(await response.arrayBuffer());
    }
    async fetchWithTimeout(url, options, timeoutMs) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
            return await fetch(url, { ...options, signal: controller.signal });
        }
        finally {
            clearTimeout(timeout);
        }
    }
    headers() {
        return {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
        };
    }
};
exports.GeraewProvider = GeraewProvider;
exports.GeraewProvider = GeraewProvider = GeraewProvider_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        uploads_service_1.UploadsService])
], GeraewProvider);
//# sourceMappingURL=geraew.provider.js.map