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
exports.EnhancePromptDto = exports.GenerationContextDto = exports.ReferenceImageDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class ReferenceImageDto {
    base64;
    mime_type;
}
exports.ReferenceImageDto = ReferenceImageDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ReferenceImageDto.prototype, "base64", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ReferenceImageDto.prototype, "mime_type", void 0);
class GenerationContextDto {
    type;
    model;
    resolution;
    aspectRatio;
    quality;
    durationSeconds;
    hasAudio;
    hasReferenceImages;
    hasFirstFrame;
    hasLastFrame;
    negativePrompt;
    sampleCount;
}
exports.GenerationContextDto = GenerationContextDto;
__decorate([
    (0, class_validator_1.IsIn)(['image', 'video']),
    __metadata("design:type", String)
], GenerationContextDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], GenerationContextDto.prototype, "model", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], GenerationContextDto.prototype, "resolution", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], GenerationContextDto.prototype, "aspectRatio", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], GenerationContextDto.prototype, "quality", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], GenerationContextDto.prototype, "durationSeconds", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], GenerationContextDto.prototype, "hasAudio", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], GenerationContextDto.prototype, "hasReferenceImages", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], GenerationContextDto.prototype, "hasFirstFrame", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], GenerationContextDto.prototype, "hasLastFrame", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], GenerationContextDto.prototype, "negativePrompt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], GenerationContextDto.prototype, "sampleCount", void 0);
class EnhancePromptDto {
    prompt;
    context;
    images;
}
exports.EnhancePromptDto = EnhancePromptDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], EnhancePromptDto.prototype, "prompt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    (0, class_transformer_1.Type)(() => GenerationContextDto),
    __metadata("design:type", GenerationContextDto)
], EnhancePromptDto.prototype, "context", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ReferenceImageDto),
    __metadata("design:type", Array)
], EnhancePromptDto.prototype, "images", void 0);
//# sourceMappingURL=enhance-prompt.dto.js.map