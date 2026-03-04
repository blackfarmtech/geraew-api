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
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const base_provider_1 = require("./base.provider");
const uploads_service_1 = require("../../uploads/uploads.service");
const RESOLUTION_MAP = {
    RES_1K: '1K',
    RES_2K: '2K',
    RES_4K: '4K',
};
let NanoBananaProvider = class NanoBananaProvider extends base_provider_1.BaseProvider {
    static { NanoBananaProvider_1 = this; }
    configService;
    uploadsService;
    logger = new common_1.Logger(NanoBananaProvider_1.name);
    apiKey;
    baseUrl;
    static POLL_INTERVAL_MS = 3000;
    static MAX_POLL_ATTEMPTS = 120;
    constructor(configService, uploadsService) {
        super();
        this.configService = configService;
        this.uploadsService = uploadsService;
        this.apiKey = this.configService.get('NANO_BANANA_API_KEY', '');
        this.baseUrl = this.configService.get('NANO_BANANA_BASE_URL', 'https://api.nanobananaapi.ai');
    }
    async generate(input) {
        this.logger.log(`Generating image with Nano Banana 2 — ${input.type} ${input.resolution}`);
        const taskId = await this.submitTask(input);
        this.logger.log(`Task submitted: ${taskId}`);
        const result = await this.pollTaskResult(taskId);
        const outputFormat = input.parameters?.outputFormat ?? 'jpg';
        const outputUrl = await this.uploadsService.uploadFromUrl(result.resultImageUrl, `generations/${input.id}`, `output.${outputFormat}`);
        this.logger.log(`Image uploaded to S3: ${outputUrl}`);
        return {
            outputUrl,
            modelUsed: 'nano-banana-2',
        };
    }
    async submitTask(input) {
        const imageUrls = [];
        if (input.type === 'IMAGE_TO_IMAGE' && input.inputImageUrl) {
            imageUrls.push(input.inputImageUrl);
        }
        const body = {
            prompt: input.prompt ?? '',
            imageUrls,
            aspectRatio: input.parameters?.aspectRatio ?? 'auto',
            resolution: RESOLUTION_MAP[input.resolution] ?? '1K',
            googleSearch: input.parameters?.googleSearch ?? false,
            outputFormat: input.parameters?.outputFormat ?? 'jpg',
            callBackUrl: 'https://noop.example.com/callback',
        };
        const response = await fetch(`${this.baseUrl}/api/v1/nanobanana/generate-2`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`NanoBanana API error (${response.status}): ${text}`);
        }
        const data = (await response.json());
        if (data.code !== 200) {
            throw new Error(`NanoBanana API error: ${data.msg}`);
        }
        return data.data.taskId;
    }
    async pollTaskResult(taskId) {
        for (let attempt = 0; attempt < NanoBananaProvider_1.MAX_POLL_ATTEMPTS; attempt++) {
            await this.sleep(NanoBananaProvider_1.POLL_INTERVAL_MS);
            const response = await fetch(`${this.baseUrl}/api/v1/nanobanana/record-info?taskId=${encodeURIComponent(taskId)}`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                },
            });
            if (!response.ok) {
                this.logger.warn(`Poll attempt ${attempt + 1} failed with status ${response.status}`);
                continue;
            }
            const data = (await response.json());
            if (data.code !== 200) {
                this.logger.warn(`Poll attempt ${attempt + 1}: ${data.msg}`);
                continue;
            }
            const { successFlag } = data.data;
            if (successFlag === 1) {
                this.logger.log(`Task ${taskId} completed successfully`);
                return data.data.response;
            }
            if (successFlag === 2) {
                throw new Error(`NanoBanana task creation failed: ${data.data.errorMessage || 'CREATE_TASK_FAILED'}`);
            }
            if (successFlag === 3) {
                throw new Error(`NanoBanana generation failed: ${data.data.errorMessage || 'GENERATE_FAILED'}`);
            }
        }
        throw new Error(`NanoBanana generation timed out after ${(NanoBananaProvider_1.MAX_POLL_ATTEMPTS * NanoBananaProvider_1.POLL_INTERVAL_MS) / 1000}s`);
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
};
exports.NanoBananaProvider = NanoBananaProvider;
exports.NanoBananaProvider = NanoBananaProvider = NanoBananaProvider_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        uploads_service_1.UploadsService])
], NanoBananaProvider);
//# sourceMappingURL=nano-banana.provider.js.map