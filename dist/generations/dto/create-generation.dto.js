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
exports.CreateGenerationDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const client_1 = require("@prisma/client");
const class_transformer_1 = require("class-transformer");
const ASPECT_RATIOS = [
    '1:1', '1:4', '1:8', '2:3', '3:2', '3:4', '4:1',
    '4:3', '4:5', '5:4', '8:1', '9:16', '16:9', '21:9', 'auto',
];
class CreateGenerationDto {
    negativePrompt;
    resolution;
    aspectRatio;
    outputFormat;
    googleSearch;
    parameters;
}
exports.CreateGenerationDto = CreateGenerationDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 2000 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateGenerationDto.prototype, "negativePrompt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: client_1.Resolution }),
    (0, class_validator_1.IsEnum)(client_1.Resolution),
    __metadata("design:type", String)
], CreateGenerationDto.prototype, "resolution", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Proporção da imagem gerada',
        enum: ASPECT_RATIOS,
        default: 'auto',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(ASPECT_RATIOS),
    __metadata("design:type", String)
], CreateGenerationDto.prototype, "aspectRatio", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Formato de saída da imagem',
        enum: ['png', 'jpg'],
        default: 'jpg',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['png', 'jpg']),
    __metadata("design:type", String)
], CreateGenerationDto.prototype, "outputFormat", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Ativar Google Search para contexto real',
        default: false,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    (0, class_transformer_1.Transform)(({ value }) => value === true || value === 'true'),
    __metadata("design:type", Boolean)
], CreateGenerationDto.prototype, "googleSearch", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Extra parameters (style, seed, etc.)' }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], CreateGenerationDto.prototype, "parameters", void 0);
//# sourceMappingURL=create-generation.dto.js.map