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
exports.GenerateImageDto = exports.ImageInputDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const swagger_1 = require("@nestjs/swagger");
const client_1 = require("@prisma/client");
class ImageInputDto {
    base64;
    mime_type;
}
exports.ImageInputDto = ImageInputDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Imagem em base64' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ImageInputDto.prototype, "base64", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'MIME type da imagem',
        default: 'image/png',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(['image/jpeg', 'image/png']),
    __metadata("design:type", String)
], ImageInputDto.prototype, "mime_type", void 0);
class GenerateImageDto {
    prompt;
    model;
    resolution;
    aspect_ratio;
    mime_type;
    images;
    model_variant;
}
exports.GenerateImageDto = GenerateImageDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Prompt de texto para gerar/editar a imagem',
        example: 'A futuristic cityscape at sunset, cyberpunk style',
    }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], GenerateImageDto.prototype, "prompt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Modelo Gemini a utilizar',
        enum: ['gemini-3-pro-image-preview', 'gemini-3.1-flash-image-preview'],
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(['gemini-3-pro-image-preview', 'gemini-3.1-flash-image-preview']),
    __metadata("design:type", String)
], GenerateImageDto.prototype, "model", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: client_1.Resolution }),
    (0, class_validator_1.IsEnum)(client_1.Resolution),
    __metadata("design:type", String)
], GenerateImageDto.prototype, "resolution", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Proporcao da imagem',
        enum: [
            '1:1',
            '3:2',
            '2:3',
            '3:4',
            '4:3',
            '4:5',
            '5:4',
            '9:16',
            '16:9',
            '21:9',
        ],
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)([
        '1:1',
        '3:2',
        '2:3',
        '3:4',
        '4:3',
        '4:5',
        '5:4',
        '9:16',
        '16:9',
        '21:9',
    ]),
    __metadata("design:type", String)
], GenerateImageDto.prototype, "aspect_ratio", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'MIME type da imagem de saida',
        example: 'image/png',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(['image/png', 'image/jpeg']),
    __metadata("design:type", String)
], GenerateImageDto.prototype, "mime_type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Imagens de input para edicao/referencia. Se presente, o tipo sera IMAGE_TO_IMAGE.',
        type: [ImageInputDto],
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ImageInputDto),
    __metadata("design:type", Array)
], GenerateImageDto.prototype, "images", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Variante do modelo (NB2, NBP)',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], GenerateImageDto.prototype, "model_variant", void 0);
//# sourceMappingURL=generate-image.dto.js.map