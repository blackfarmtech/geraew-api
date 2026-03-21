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
var WanProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WanProvider = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const uploads_service_1 = require("../../uploads/uploads.service");
let WanProvider = WanProvider_1 = class WanProvider {
    configService;
    uploadsService;
    logger = new common_1.Logger(WanProvider_1.name);
    baseUrl;
    apiKey;
    constructor(configService, uploadsService) {
        this.configService = configService;
        this.uploadsService = uploadsService;
        this.baseUrl = this.configService.get('NANO_BANANA_BASE_URL', 'https://api.kie.ai');
        this.apiKey = this.configService.get('NANO_BANANA_API_KEY', '');
    }
    async generateAnimateReplace(input) {
        this.logger.log(`Creating Kling 2.6 Motion Control task — mode ${input.resolution}`);
        const body = {
            model: 'kling-2.6/motion-control',
            input: {
                input_urls: [input.imageUrl],
                video_urls: [input.videoUrl],
                character_orientation: 'video',
                mode: input.resolution,
                ...(input.prompt ? { prompt: input.prompt } : {}),
            },
        };
        const createResponse = await this.fetchWithTimeout(`${this.baseUrl}/api/v1/jobs/createTask`, {
            method: 'POST',
            headers: this.headers(),
            body: JSON.stringify(body),
        }, 60_000);
        if (!createResponse.ok) {
            const errorText = await createResponse.text();
            throw new Error(`Kling createTask error (${createResponse.status}): ${errorText}`);
        }
        const createData = (await createResponse.json());
        if (createData.code !== 200) {
            throw new Error(`Kling createTask failed: ${createData.msg} (code ${createData.code})`);
        }
        const taskId = createData.data.taskId;
        this.logger.log(`Kling task created: ${taskId}`);
        const resultUrls = await this.pollTaskStatus(taskId);
        const outputUrls = [];
        for (let i = 0; i < resultUrls.length; i++) {
            const url = await this.downloadAndUpload(resultUrls[i], input.id, i);
            outputUrls.push(url);
        }
        if (!outputUrls.length) {
            throw new Error('Kling Motion Control returned no videos.');
        }
        this.logger.log(`${outputUrls.length} video(s) uploaded to S3`);
        return { outputUrls, modelUsed: 'kling-2.6/motion-control' };
    }
    async pollTaskStatus(taskId, maxAttempts = 120, intervalMs = 5_000) {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            if (attempt > 0) {
                await new Promise((resolve) => setTimeout(resolve, intervalMs));
            }
            const response = await this.fetchWithTimeout(`${this.baseUrl}/api/v1/jobs/recordInfo?taskId=${taskId}`, { headers: this.headers() }, 30_000);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Kling recordInfo error (${response.status}): ${errorText}`);
            }
            const data = (await response.json());
            if (data.data.state === 'waiting') {
                this.logger.debug(`Kling task still processing... (attempt ${attempt + 1}/${maxAttempts})`);
                continue;
            }
            if (data.data.state === 'fail') {
                throw new Error(`Kling generation failed: ${data.data.failMsg ?? data.data.failCode ?? 'unknown error'}`);
            }
            if (data.data.state === 'success') {
                if (!data.data.resultJson) {
                    throw new Error('Kling succeeded but returned no resultJson.');
                }
                const result = JSON.parse(data.data.resultJson);
                if (!result.resultUrls?.length) {
                    throw new Error('Kling succeeded but returned no video URLs.');
                }
                return result.resultUrls;
            }
        }
        throw new Error('Kling generation timed out.');
    }
    async downloadAndUpload(sourceUrl, generationId, index) {
        const response = await this.fetchWithTimeout(sourceUrl, {}, 120_000);
        if (!response.ok) {
            throw new Error(`Failed to download video from Kling (${response.status}): ${sourceUrl}`);
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        return this.uploadsService.uploadBuffer(buffer, `generations/${generationId}`, `output_${index}.mp4`, 'video/mp4');
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
            Authorization: `Bearer ${this.apiKey}`,
        };
    }
};
exports.WanProvider = WanProvider;
exports.WanProvider = WanProvider = WanProvider_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        uploads_service_1.UploadsService])
], WanProvider);
//# sourceMappingURL=wan.provider.js.map