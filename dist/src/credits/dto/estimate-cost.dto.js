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
exports.EstimateCostResponseDto = exports.EstimateCostDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const swagger_1 = require("@nestjs/swagger");
const client_1 = require("@prisma/client");
class EstimateCostDto {
    type;
    resolution;
    durationSeconds;
    hasAudio;
    sampleCount;
    modelVariant;
}
exports.EstimateCostDto = EstimateCostDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: client_1.GenerationType }),
    (0, class_validator_1.IsEnum)(client_1.GenerationType),
    __metadata("design:type", String)
], EstimateCostDto.prototype, "type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: client_1.Resolution }),
    (0, class_validator_1.IsEnum)(client_1.Resolution),
    __metadata("design:type", String)
], EstimateCostDto.prototype, "resolution", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Duration in seconds (for video types)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], EstimateCostDto.prototype, "durationSeconds", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], EstimateCostDto.prototype, "hasAudio", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Number of samples to generate', default: 1 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], EstimateCostDto.prototype, "sampleCount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Model variant (e.g. NB2, NBP, VEO_FAST, VEO_MAX)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EstimateCostDto.prototype, "modelVariant", void 0);
class EstimateCostResponseDto {
    creditsRequired;
    hasSufficientBalance;
}
exports.EstimateCostResponseDto = EstimateCostResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], EstimateCostResponseDto.prototype, "creditsRequired", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], EstimateCostResponseDto.prototype, "hasSufficientBalance", void 0);
//# sourceMappingURL=estimate-cost.dto.js.map