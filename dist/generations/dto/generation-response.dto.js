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
exports.CreateGenerationResponseDto = exports.GenerationResponseDto = exports.GenerationInputImageDto = exports.GenerationOutputDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const client_1 = require("@prisma/client");
class GenerationOutputDto {
    id;
    url;
    mimeType;
    order;
}
exports.GenerationOutputDto = GenerationOutputDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], GenerationOutputDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], GenerationOutputDto.prototype, "url", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", String)
], GenerationOutputDto.prototype, "mimeType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], GenerationOutputDto.prototype, "order", void 0);
class GenerationInputImageDto {
    id;
    role;
    mimeType;
    order;
    referenceType;
    url;
}
exports.GenerationInputImageDto = GenerationInputImageDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], GenerationInputImageDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: client_1.GenerationImageRole }),
    __metadata("design:type", String)
], GenerationInputImageDto.prototype, "role", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", String)
], GenerationInputImageDto.prototype, "mimeType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], GenerationInputImageDto.prototype, "order", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: "'asset' | 'style' — apenas para videos com referencia" }),
    __metadata("design:type", String)
], GenerationInputImageDto.prototype, "referenceType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'S3 URL da imagem, se disponivel' }),
    __metadata("design:type", String)
], GenerationInputImageDto.prototype, "url", void 0);
class GenerationResponseDto {
    id;
    type;
    status;
    prompt;
    negativePrompt;
    resolution;
    durationSeconds;
    hasAudio;
    modelUsed;
    parameters;
    outputs;
    inputImages;
    hasWatermark;
    creditsConsumed;
    processingTimeMs;
    errorMessage;
    errorCode;
    isFavorited;
    createdAt;
    completedAt;
}
exports.GenerationResponseDto = GenerationResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], GenerationResponseDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: client_1.GenerationType }),
    __metadata("design:type", String)
], GenerationResponseDto.prototype, "type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: client_1.GenerationStatus }),
    __metadata("design:type", String)
], GenerationResponseDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", String)
], GenerationResponseDto.prototype, "prompt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", String)
], GenerationResponseDto.prototype, "negativePrompt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: client_1.Resolution }),
    __metadata("design:type", String)
], GenerationResponseDto.prototype, "resolution", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", Number)
], GenerationResponseDto.prototype, "durationSeconds", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], GenerationResponseDto.prototype, "hasAudio", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", String)
], GenerationResponseDto.prototype, "modelUsed", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", Object)
], GenerationResponseDto.prototype, "parameters", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [GenerationOutputDto] }),
    __metadata("design:type", Array)
], GenerationResponseDto.prototype, "outputs", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [GenerationInputImageDto] }),
    __metadata("design:type", Array)
], GenerationResponseDto.prototype, "inputImages", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], GenerationResponseDto.prototype, "hasWatermark", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], GenerationResponseDto.prototype, "creditsConsumed", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", Number)
], GenerationResponseDto.prototype, "processingTimeMs", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", String)
], GenerationResponseDto.prototype, "errorMessage", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", String)
], GenerationResponseDto.prototype, "errorCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], GenerationResponseDto.prototype, "isFavorited", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Date)
], GenerationResponseDto.prototype, "createdAt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", Date)
], GenerationResponseDto.prototype, "completedAt", void 0);
class CreateGenerationResponseDto {
    id;
    status;
    creditsConsumed;
}
exports.CreateGenerationResponseDto = CreateGenerationResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], CreateGenerationResponseDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: client_1.GenerationStatus }),
    __metadata("design:type", String)
], CreateGenerationResponseDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], CreateGenerationResponseDto.prototype, "creditsConsumed", void 0);
//# sourceMappingURL=generation-response.dto.js.map