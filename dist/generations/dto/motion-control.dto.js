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
exports.MotionControlDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const swagger_1 = require("@nestjs/swagger");
const create_generation_dto_1 = require("./create-generation.dto");
class MotionControlDto extends create_generation_dto_1.CreateGenerationDto {
    inputImageUrl;
    referenceVideoUrl;
    durationSeconds;
}
exports.MotionControlDto = MotionControlDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'URL da imagem de input (S3 key ou URL pré-assinada)' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'URL da imagem de input é obrigatória' }),
    __metadata("design:type", String)
], MotionControlDto.prototype, "inputImageUrl", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'URL do vídeo de referência para motion control' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'URL do vídeo de referência é obrigatória' }),
    __metadata("design:type", String)
], MotionControlDto.prototype, "referenceVideoUrl", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Duração do vídeo em segundos', minimum: 1, maximum: 30 }),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(30),
    __metadata("design:type", Number)
], MotionControlDto.prototype, "durationSeconds", void 0);
//# sourceMappingURL=motion-control.dto.js.map