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
exports.GenerateVideoImageToVideoDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const swagger_1 = require("@nestjs/swagger");
const client_1 = require("@prisma/client");
class GenerateVideoImageToVideoDto {
    prompt;
    model;
    resolution;
    duration_seconds;
    aspect_ratio;
    generate_audio;
    sample_count;
    negative_prompt;
    first_frame;
    first_frame_mime_type;
    last_frame;
    last_frame_mime_type;
}
exports.GenerateVideoImageToVideoDto = GenerateVideoImageToVideoDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Prompt de texto para gerar o video',
        example: 'A cinematic aerial shot of a coastal city at sunset',
    }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], GenerateVideoImageToVideoDto.prototype, "prompt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Modelo do Vertex AI',
        default: 'veo-3.1-generate-preview',
        example: 'veo-3.1-generate-preview',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(['veo-3.1-generate-preview', 'veo-3.1-fast-generate-preview']),
    __metadata("design:type", String)
], GenerateVideoImageToVideoDto.prototype, "model", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: client_1.Resolution }),
    (0, class_validator_1.IsEnum)(client_1.Resolution),
    __metadata("design:type", String)
], GenerateVideoImageToVideoDto.prototype, "resolution", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Duracao do video em segundos',
        default: 8,
        example: 8,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], GenerateVideoImageToVideoDto.prototype, "duration_seconds", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Proporcao do video',
        enum: ['16:9', '9:16'],
        default: '16:9',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(['16:9', '9:16']),
    __metadata("design:type", String)
], GenerateVideoImageToVideoDto.prototype, "aspect_ratio", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Gerar audio junto com o video',
        default: true,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Boolean),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], GenerateVideoImageToVideoDto.prototype, "generate_audio", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Quantidade de amostras a gerar',
        default: 1,
        example: 1,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], GenerateVideoImageToVideoDto.prototype, "sample_count", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Prompt negativo (o que evitar)',
        example: 'blurry, low quality',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], GenerateVideoImageToVideoDto.prototype, "negative_prompt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Imagem de input em base64 (primeiro frame)' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], GenerateVideoImageToVideoDto.prototype, "first_frame", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'MIME type da imagem de input',
        default: 'image/jpeg',
        example: 'image/jpeg',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], GenerateVideoImageToVideoDto.prototype, "first_frame_mime_type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Ultimo frame em base64 (para controle de final do video)',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], GenerateVideoImageToVideoDto.prototype, "last_frame", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'MIME type do ultimo frame',
        default: 'image/jpeg',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], GenerateVideoImageToVideoDto.prototype, "last_frame_mime_type", void 0);
//# sourceMappingURL=generate-video-image-to-video.dto.js.map