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
exports.TextToVideoDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const swagger_1 = require("@nestjs/swagger");
const create_generation_dto_1 = require("./create-generation.dto");
class TextToVideoDto extends create_generation_dto_1.CreateGenerationDto {
    prompt;
    durationSeconds;
    hasAudio;
    referenceImageUrls;
}
exports.TextToVideoDto = TextToVideoDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Prompt para geração de vídeo', maxLength: 5000 }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'Prompt é obrigatório para text-to-video' }),
    (0, class_validator_1.MaxLength)(5000, { message: 'Prompt excede o limite de 5000 caracteres' }),
    __metadata("design:type", String)
], TextToVideoDto.prototype, "prompt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Duração do vídeo em segundos', minimum: 1, maximum: 30 }),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(30),
    __metadata("design:type", Number)
], TextToVideoDto.prototype, "durationSeconds", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Se o vídeo deve ter áudio', default: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], TextToVideoDto.prototype, "hasAudio", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'URLs de imagens de referência (S3 keys), máximo 3' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(3),
    __metadata("design:type", Array)
], TextToVideoDto.prototype, "referenceImageUrls", void 0);
//# sourceMappingURL=text-to-video.dto.js.map