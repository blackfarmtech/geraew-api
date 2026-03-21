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
var NanoBananaProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NanoBananaProvider = void 0;
exports.mapGeminiToNanoBanana = mapGeminiToNanoBanana;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const uploads_service_1 = require("../../uploads/uploads.service");
const RESOLUTION_MAP = {
    RES_1K: '1K',
    RES_2K: '2K',
    RES_4K: '4K',
};
const GEMINI_TO_NANO_BANANA = {
    'gemini-3-pro-image-preview': 'nano-banana-pro',
    'gemini-3.1-flash-image-preview': 'nano-banana-2',
};
function mapGeminiToNanoBanana(geminiModel) {
    return GEMINI_TO_NANO_BANANA[geminiModel] ?? 'nano-banana-2';
}
let NanoBananaProvider = NanoBananaProvider_1 = class NanoBananaProvider {
    configService;
    uploadsService;
    logger = new common_1.Logger(NanoBananaProvider_1.name);
    baseUrl;
    apiKey;
    constructor(configService, uploadsService) {
        this.configService = configService;
        this.uploadsService = uploadsService;
        this.baseUrl = this.configService.get('NANO_BANANA_BASE_URL', 'https://api.kie.ai');
        this.apiKey = this.configService.get('NANO_BANANA_API_KEY', '');
    }
    async generateImage(input) {
        const model = input.model ?? 'nano-banana-2';
        this.logger.log(`Creating ${model} task — resolution ${input.resolution}`);
        const resolution = RESOLUTION_MAP[input.resolution] ?? '1K';
        const body = {
            model,
            input: {
                prompt: input.prompt,
                resolution,
                aspect_ratio: input.aspectRatio ?? 'auto',
                output_format: input.outputFormat ?? 'png',
                google_search: input.googleSearch ?? false,
                ...(input.imageUrls?.length && { image_input: input.imageUrls }),
            },
        };
        const createResponse = await this.fetchWithTimeout(`${this.baseUrl}/api/v1/jobs/createTask`, {
            method: 'POST',
            headers: this.headers(),
            body: JSON.stringify(body),
        }, 60_000);
        if (!createResponse.ok) {
            const errorText = await createResponse.text();
            throw new Error(`Nano Banana createTask error (${createResponse.status}): ${errorText}`);
        }
        const createData = (await createResponse.json());
        if (createData.code !== 200) {
            throw new Error(`Nano Banana createTask failed: ${createData.msg} (code ${createData.code})`);
        }
        const taskId = createData.data.taskId;
        this.logger.log(`Nano Banana task created: ${taskId}`);
        const resultUrls = await this.pollTaskStatus(taskId);
        const outputUrls = [];
        for (let i = 0; i < resultUrls.length; i++) {
            const url = await this.downloadAndUpload(resultUrls[i], input.id, i, input.outputFormat ?? 'png');
            outputUrls.push(url);
        }
        if (!outputUrls.length) {
            throw new Error('Nano Banana returned no images.');
        }
        this.logger.log(`${outputUrls.length} image(s) uploaded to S3`);
        return { outputUrls, modelUsed: model };
    }
    async pollTaskStatus(taskId, maxAttempts = 120, intervalMs = 5_000) {
        const maxNetworkRetries = 5;
        let networkFailures = 0;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            if (attempt > 0) {
                await new Promise((resolve) => setTimeout(resolve, intervalMs));
            }
            let response;
            try {
                response = await this.fetchWithTimeout(`${this.baseUrl}/api/v1/jobs/recordInfo?taskId=${taskId}`, { headers: this.headers() }, 30_000);
            }
            catch (error) {
                networkFailures++;
                this.logger.warn(`Nano Banana poll fetch failed (${networkFailures}/${maxNetworkRetries}): ${error.message}`);
                if (networkFailures >= maxNetworkRetries) {
                    throw error;
                }
                continue;
            }
            if (!response.ok) {
                networkFailures++;
                const errorText = await response.text();
                this.logger.warn(`Nano Banana poll HTTP error ${response.status} (${networkFailures}/${maxNetworkRetries}): ${errorText}`);
                if (networkFailures >= maxNetworkRetries) {
                    throw new Error(`Nano Banana recordInfo error (${response.status}): ${errorText}`);
                }
                continue;
            }
            networkFailures = 0;
            const data = (await response.json());
            if (data.data.state === 'waiting') {
                this.logger.debug(`Nano Banana task still processing... (attempt ${attempt + 1}/${maxAttempts})`);
                continue;
            }
            if (data.data.state === 'fail') {
                throw new Error(`Nano Banana generation failed: ${data.data.failMsg ?? data.data.failCode ?? 'unknown error'}`);
            }
            if (data.data.state === 'success') {
                if (!data.data.resultJson) {
                    throw new Error('Nano Banana succeeded but returned no resultJson.');
                }
                const result = JSON.parse(data.data.resultJson);
                if (!result.resultUrls?.length) {
                    throw new Error('Nano Banana succeeded but returned no image URLs.');
                }
                return result.resultUrls;
            }
        }
        throw new Error('Nano Banana generation timed out.');
    }
    async downloadAndUpload(sourceUrl, generationId, index, format) {
        const maxRetries = 3;
        let lastError;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                if (attempt > 0) {
                    await new Promise((resolve) => setTimeout(resolve, 2_000));
                    this.logger.warn(`Retrying downloadAndUpload (${attempt + 1}/${maxRetries}) for ${generationId}`);
                }
                const response = await this.fetchWithTimeout(sourceUrl, {}, 60_000);
                if (!response.ok) {
                    throw new Error(`Failed to download image from Nano Banana (${response.status}): ${sourceUrl}`);
                }
                const buffer = Buffer.from(await response.arrayBuffer());
                const ext = format === 'jpg' ? 'jpg' : 'png';
                const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
                return await this.uploadsService.uploadBuffer(buffer, `generations/${generationId}`, `output_${index}.${ext}`, mimeType);
            }
            catch (error) {
                lastError = error;
            }
        }
        throw lastError;
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
exports.NanoBananaProvider = NanoBananaProvider;
exports.NanoBananaProvider = NanoBananaProvider = NanoBananaProvider_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        uploads_service_1.UploadsService])
], NanoBananaProvider);
//# sourceMappingURL=nano-banana.provider.js.map