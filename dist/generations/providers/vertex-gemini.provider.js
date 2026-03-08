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
var VertexGeminiProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VertexGeminiProvider = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const base_provider_1 = require("./base.provider");
const uploads_service_1 = require("../../uploads/uploads.service");
const IMAGE_SIZE_MAP = {
    RES_1K: '1K',
    RES_2K: '2K',
    RES_4K: '4K',
};
const IMAGE_ASPECT_RATIOS = [
    '1:1',
    '2:3',
    '3:2',
    '3:4',
    '4:3',
    '4:5',
    '5:4',
    '9:16',
    '16:9',
];
let VertexGeminiProvider = VertexGeminiProvider_1 = class VertexGeminiProvider extends base_provider_1.BaseProvider {
    configService;
    uploadsService;
    logger = new common_1.Logger(VertexGeminiProvider_1.name);
    baseUrl;
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
            default:
                throw new Error(`Unsupported generation type for VertexGemini: ${input.type}`);
        }
    }
    async generateImage(input) {
        this.logger.log(`Generating image via Vertex Gemini — ${input.type} ${input.resolution}`);
        const aspectRatio = this.resolveAspectRatio(input);
        const imageSize = IMAGE_SIZE_MAP[input.resolution] ?? '1K';
        const outputFormat = input.parameters?.outputFormat ?? 'png';
        const body = {
            prompt: input.prompt ?? '',
            model: input.parameters?.imageModel,
            aspect_ratio: aspectRatio,
            image_size: imageSize,
            mime_type: `image/${outputFormat}`,
            person_generation: 'ALLOW_ALL',
            temperature: 1,
            location: 'us-central1',
        };
        if (input.type === 'IMAGE_TO_IMAGE' && input.inputImageUrl) {
            const { base64, mimeType } = await this.downloadImageAsBase64(input.inputImageUrl);
            body.images = [{ base64, mime_type: mimeType }];
        }
        const response = await fetch(`${this.baseUrl}/api/image/generate-gemini`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Vertex Gemini API error (${response.status}): ${errorText}`);
        }
        const data = (await response.json());
        const imagePart = data.parts?.find((p) => p.type === 'image');
        if (!imagePart || imagePart.type !== 'image') {
            throw new Error('Vertex Gemini: No image returned in response. Try a different prompt.');
        }
        const buffer = Buffer.from(imagePart.base64, 'base64');
        const ext = imagePart.mimeType === 'image/jpeg' ? 'jpg' : 'png';
        const outputUrl = await this.uploadsService.uploadBuffer(buffer, `generations/${input.id}`, `output.${ext}`, imagePart.mimeType);
        this.logger.log(`Image uploaded to S3: ${outputUrl}`);
        return {
            outputUrl,
            modelUsed: 'gemini-3-pro-image-preview',
        };
    }
    resolveAspectRatio(input) {
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
};
exports.VertexGeminiProvider = VertexGeminiProvider;
exports.VertexGeminiProvider = VertexGeminiProvider = VertexGeminiProvider_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        uploads_service_1.UploadsService])
], VertexGeminiProvider);
//# sourceMappingURL=vertex-gemini.provider.js.map