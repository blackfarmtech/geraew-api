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
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenerateImageNanoBananaDto = exports.NanoBananaImageInputDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const swagger_1 = require("@nestjs/swagger");
const client_1 = require("@prisma/client");
class NanoBananaImageInputDto {
    base64;
    mime_type;
}
exports.NanoBananaImageInputDto = NanoBananaImageInputDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Imagem em base64' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], NanoBananaImageInputDto.prototype, "base64", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'MIME type da imagem',
        default: 'image/png',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(['image/jpeg', 'image/png', 'image/webp']),
    __metadata("design:type", String)
], NanoBananaImageInputDto.prototype, "mime_type", void 0);
class GenerateImageNanoBananaDto {
    prompt;
    resolution;
    aspect_ratio;
    output_format;
    google_search;
    images;
}
exports.GenerateImageNanoBananaDto = GenerateImageNanoBananaDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Prompt de texto para gerar/editar a imagem',
        example: 'A futuristic cityscape at sunset, cyberpunk style',
    }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], GenerateImageNanoBananaDto.prototype, "prompt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Resolução da imagem',
        enum: [client_1.Resolution.RES_1K, client_1.Resolution.RES_2K, client_1.Resolution.RES_4K],
    }),
    (0, class_validator_1.IsEnum)(client_1.Resolution),
    (0, class_validator_1.IsIn)([client_1.Resolution.RES_1K, client_1.Resolution.RES_2K, client_1.Resolution.RES_4K]),
    __metadata("design:type", String)
], GenerateImageNanoBananaDto.prototype, "resolution", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Proporção da imagem',
        enum: [
            '1:1',
            '1:4',
            '1:8',
            '2:3',
            '3:2',
            '3:4',
            '4:1',
            '4:3',
            '4:5',
            '5:4',
            '8:1',
            '9:16',
            '16:9',
            '21:9',
            'auto',
        ],
        default: 'auto',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)([
        '1:1',
        '1:4',
        '1:8',
        '2:3',
        '3:2',
        '3:4',
        '4:1',
        '4:3',
        '4:5',
        '5:4',
        '8:1',
        '9:16',
        '16:9',
        '21:9',
        'auto',
    ]),
    __metadata("design:type", String)
], GenerateImageNanoBananaDto.prototype, "aspect_ratio", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Formato da imagem de saída',
        enum: ['jpg', 'png'],
        default: 'png',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(['jpg', 'png']),
    __metadata("design:type", String)
], GenerateImageNanoBananaDto.prototype, "output_format", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Usar Google Search para gerar imagens baseadas em informações em tempo real',
        default: false,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], GenerateImageNanoBananaDto.prototype, "google_search", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Imagens de input para edição/referência (até 14). Se presente, o tipo será IMAGE_TO_IMAGE.',
        type: [NanoBananaImageInputDto],
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => NanoBananaImageInputDto),
    __metadata("design:type", Array)
], GenerateImageNanoBananaDto.prototype, "images", void 0);
//# sourceMappingURL=generate-image-nano-banana.dto.js.map