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
var GeminiMediaProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiMediaProvider = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const base_provider_1 = require("./base.provider");
const uploads_service_1 = require("../../uploads/uploads.service");
const VIDEO_RESOLUTION_MAP = {
    RES_720P: '720p',
    RES_1080P: '1080p',
    RES_4K: '4k',
};
const IMAGE_SIZE_MAP = {
    RES_1K: '1K',
    RES_2K: '2K',
    RES_4K: '4K',
};
const VIDEO_ASPECT_RATIOS = ['16:9', '9:16'];
const IMAGE_ASPECT_RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9'];
let GeminiMediaProvider = class GeminiMediaProvider extends base_provider_1.BaseProvider {
    static { GeminiMediaProvider_1 = this; }
    configService;
    uploadsService;
    logger = new common_1.Logger(GeminiMediaProvider_1.name);
    baseUrl;
    static POLL_INTERVAL_MS = 10_000;
    static MAX_POLL_ATTEMPTS = 40;
    constructor(configService, uploadsService) {
        super();
        this.configService = configService;
        this.uploadsService = uploadsService;
        this.baseUrl = this.configService.get('GEMINI_MEDIA_BASE_URL', 'http://localhost:3001');
    }
    async generate(input) {
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
    async generateImage(input) {
        this.logger.log(`Generating image — ${input.type} ${input.resolution}`);
        const aspectRatio = this.resolveImageAspectRatio(input);
        const imageSize = IMAGE_SIZE_MAP[input.resolution] ?? '1K';
        const body = {
            prompt: input.prompt ?? '',
            aspectRatio,
            imageSize,
            model: input.parameters?.imageModel,
        };
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
        const data = (await response.json());
        const buffer = Buffer.from(data.imageData, 'base64');
        const ext = data.mimeType === 'image/jpeg' ? 'jpg' : 'png';
        const outputUrl = await this.uploadsService.uploadBuffer(buffer, `generations/${input.id}`, `output.${ext}`, data.mimeType);
        this.logger.log(`Image uploaded to S3: ${outputUrl}`);
        return {
            outputUrl,
            modelUsed: 'gemini-media',
        };
    }
    async generateTextToVideo(input) {
        const referenceImageUrls = input.parameters?.referenceImageUrls;
        this.logger.log(`Generating text-to-video — ${input.resolution} ${input.durationSeconds}s` +
            (referenceImageUrls?.length ? ` with ${referenceImageUrls.length} reference(s)` : ''));
        const body = {
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
        if (referenceImageUrls?.length) {
            const referenceImages = await Promise.all(referenceImageUrls.map(async (url) => {
                const { base64, mimeType } = await this.downloadImageAsBase64(url);
                return { base64, mime_type: mimeType, reference_type: 'asset' };
            }));
            body.reference_images = referenceImages;
        }
        const operationName = await this.submitVideoGeneration(body);
        return this.pollAndUploadVideo(operationName, input.id);
    }
    async generateImageToVideo(input) {
        this.logger.log(`Generating image-to-video — ${input.resolution} ${input.durationSeconds}s`);
        if (!input.inputImageUrl) {
            throw new Error('inputImageUrl is required for IMAGE_TO_VIDEO');
        }
        const { base64, mimeType } = await this.downloadImageAsBase64(input.inputImageUrl);
        const body = {
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
        const lastFrameUrl = input.parameters?.lastFrameUrl;
        if (lastFrameUrl) {
            const lastFrame = await this.downloadImageAsBase64(lastFrameUrl);
            body.last_frame_base64 = lastFrame.base64;
            body.last_frame_mime_type = lastFrame.mimeType;
        }
        const operationName = await this.submitVideoGeneration(body);
        return this.pollAndUploadVideo(operationName, input.id);
    }
    async submitVideoGeneration(body) {
        const response = await fetch(`${this.baseUrl}/api/video/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`GeminiMedia video API error (${response.status}): ${errorBody}`);
        }
        const data = (await response.json());
        if (!data.operationName) {
            throw new Error('GeminiMedia video API returned no operation name');
        }
        this.logger.log(`Video operation submitted: ${data.operationName}`);
        return data.operationName;
    }
    async pollAndUploadVideo(operationName, generationId) {
        const videoData = await this.pollVideoStatus(operationName);
        if (videoData.base64) {
            const buffer = Buffer.from(videoData.base64, 'base64');
            const ext = videoData.mimeType === 'video/webm' ? 'webm' : 'mp4';
            const outputUrl = await this.uploadsService.uploadBuffer(buffer, `generations/${generationId}`, `output.${ext}`, videoData.mimeType);
            this.logger.log(`Video uploaded to S3: ${outputUrl}`);
            return { outputUrl, modelUsed: 'gemini-media' };
        }
        if (videoData.gcsUri) {
            const outputUrl = await this.uploadsService.uploadFromUrl(videoData.gcsUri, `generations/${generationId}`, 'output.mp4');
            this.logger.log(`Video uploaded to S3 from GCS: ${outputUrl}`);
            return { outputUrl, modelUsed: 'gemini-media' };
        }
        throw new Error('Video generation completed but returned no video data');
    }
    async pollVideoStatus(operationName) {
        for (let attempt = 0; attempt < GeminiMediaProvider_1.MAX_POLL_ATTEMPTS; attempt++) {
            await this.sleep(GeminiMediaProvider_1.POLL_INTERVAL_MS);
            const response = await fetch(`${this.baseUrl}/api/video/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ operationName }),
            });
            if (!response.ok) {
                this.logger.warn(`Poll attempt ${attempt + 1} failed with status ${response.status}`);
                continue;
            }
            const data = (await response.json());
            if (data.done && data.error) {
                throw new Error(`GeminiMedia video generation failed: [${data.error.code}] ${data.error.message}`);
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
        throw new Error(`GeminiMedia video generation timed out after ${(GeminiMediaProvider_1.MAX_POLL_ATTEMPTS * GeminiMediaProvider_1.POLL_INTERVAL_MS) / 1000}s`);
    }
    resolveVideoAspectRatio(input) {
        const ratio = input.parameters?.aspectRatio ?? '16:9';
        return VIDEO_ASPECT_RATIOS.includes(ratio) ? ratio : '16:9';
    }
    resolveImageAspectRatio(input) {
        const ratio = input.parameters?.aspectRatio ?? '1:1';
        return IMAGE_ASPECT_RATIOS.includes(ratio) ? ratio : '1:1';
    }
    async downloadImageAsBase64(imageUrl) {
        const response = await fetch(imageUrl);
        if (!response.ok) {
            throw new Error(`Failed to download image (${response.status}): ${imageUrl}`);
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        const mimeType = response.headers.get('content-type') ?? 'image/png';
        return {
            base64: buffer.toString('base64'),
            mimeType,
        };
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
};
exports.GeminiMediaProvider = GeminiMediaProvider;
exports.GeminiMediaProvider = GeminiMediaProvider = GeminiMediaProvider_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        uploads_service_1.UploadsService])
], GeminiMediaProvider);
//# sourceMappingURL=gemini-media.provider.js.map