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
var VeoProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VeoProvider = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const base_provider_1 = require("./base.provider");
const uploads_service_1 = require("../../uploads/uploads.service");
let VeoProvider = class VeoProvider extends base_provider_1.BaseProvider {
    static { VeoProvider_1 = this; }
    configService;
    uploadsService;
    logger = new common_1.Logger(VeoProvider_1.name);
    apiKey;
    baseUrl;
    static POLL_INTERVAL_MS = 5000;
    static MAX_POLL_ATTEMPTS = 180;
    constructor(configService, uploadsService) {
        super();
        this.configService = configService;
        this.uploadsService = uploadsService;
        this.apiKey = this.configService.get('VEO_API_KEY', '');
        this.baseUrl = this.configService.get('VEO_BASE_URL', 'https://us-central1-aiplatform.googleapis.com/v1/projects/project-da91ddc4-fae8-4fe8-928/locations/us-central1/publishers/google/models/veo-3.1-generate-preview');
    }
    async generate(input) {
        this.logger.log(`Generating video with Veo 3.1 — ${input.type} ${input.resolution} ${input.durationSeconds}s audio:${input.hasAudio}`);
        const body = await this.buildRequestBody(input);
        const operationName = await this.submitPrediction(body);
        this.logger.log(`Operation submitted: ${operationName}`);
        const result = await this.pollOperation(operationName);
        const gcsUri = result.videos[0].gcsUri;
        const publicUrl = this.gcsToPublicUrl(gcsUri);
        const outputUrl = await this.uploadsService.uploadFromUrl(publicUrl, `generations/${input.id}`, 'output.mp4');
        this.logger.log(`Video uploaded to S3: ${outputUrl}`);
        return {
            outputUrl,
            modelUsed: 'veo-3.1',
        };
    }
    async buildRequestBody(input) {
        const aspectRatio = input.parameters?.aspectRatio ?? '9:16';
        const durationSeconds = input.durationSeconds ?? 8;
        const instance = {
            prompt: input.prompt ?? '',
        };
        console.log({ input });
        if (input.type === 'IMAGE_TO_VIDEO' && input.inputImageUrl) {
            const imageBase64 = await this.downloadImageAsBase64(input.inputImageUrl);
            instance.referenceImages = [
                {
                    image: {
                        bytesBase64Encoded: imageBase64,
                        mimeType: 'image/jpeg',
                    },
                    referenceType: 'asset',
                },
            ];
        }
        console.log(instance);
        console.log({
            aspectRatio,
            sampleCount: 1,
            durationSeconds,
            storageUri: 'gs://bucketvertex3424234',
            personGeneration: 'allow_all',
            generateAudio: input.hasAudio,
            resolution: '1080p',
            seed: 0,
        });
        return {
            instances: [instance],
            parameters: {
                aspectRatio,
                sampleCount: 1,
                durationSeconds,
                storageUri: 'gs://bucketvertex3424234',
                personGeneration: 'allow_all',
                generateAudio: input.hasAudio,
                resolution: '1080p',
                seed: 0,
            },
        };
    }
    async submitPrediction(body) {
        const url = `${this.baseUrl}:predictLongRunning`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Veo API error (${response.status}): ${text}`);
        }
        const data = (await response.json());
        if (!data.name) {
            throw new Error('Veo API returned no operation name');
        }
        return data.name;
    }
    async pollOperation(operationName) {
        const url = `${this.baseUrl}:fetchPredictOperation`;
        for (let attempt = 0; attempt < VeoProvider_1.MAX_POLL_ATTEMPTS; attempt++) {
            await this.sleep(VeoProvider_1.POLL_INTERVAL_MS);
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ operationName }),
            });
            if (!response.ok) {
                this.logger.warn(`Poll attempt ${attempt + 1} failed with status ${response.status}`);
                continue;
            }
            const data = (await response.json());
            if (data.done && data.response) {
                this.logger.log(`Operation completed successfully`);
                if (!data.response.videos || data.response.videos.length === 0) {
                    throw new Error(`Veo generation completed but returned no videos (filtered: ${data.response.raiMediaFilteredCount})`);
                }
                return { videos: data.response.videos };
            }
            this.logger.debug(`Poll attempt ${attempt + 1}: still processing...`);
        }
        throw new Error(`Veo generation timed out after ${(VeoProvider_1.MAX_POLL_ATTEMPTS * VeoProvider_1.POLL_INTERVAL_MS) / 1000}s`);
    }
    gcsToPublicUrl(gcsUri) {
        const withoutPrefix = gcsUri.replace('gs://', '');
        return `https://storage.googleapis.com/${withoutPrefix}`;
    }
    async downloadImageAsBase64(imageUrl) {
        const response = await fetch(imageUrl);
        if (!response.ok) {
            throw new Error(`Failed to download reference image (${response.status}): ${imageUrl}`);
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        return buffer.toString('base64');
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
};
exports.VeoProvider = VeoProvider;
exports.VeoProvider = VeoProvider = VeoProvider_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        uploads_service_1.UploadsService])
], VeoProvider);
//# sourceMappingURL=veo.provider.js.map