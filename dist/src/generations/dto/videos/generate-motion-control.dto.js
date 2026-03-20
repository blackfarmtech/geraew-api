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
exports.GenerateMotionControlDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
class GenerateMotionControlDto {
    video;
    video_mime_type;
    image;
    image_mime_type;
    resolution;
}
exports.GenerateMotionControlDto = GenerateMotionControlDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Vídeo de referência em base64' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], GenerateMotionControlDto.prototype, "video", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'MIME type do vídeo',
        enum: ['video/mp4', 'video/quicktime', 'video/x-matroska'],
        default: 'video/mp4',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(['video/mp4', 'video/quicktime', 'video/x-matroska']),
    __metadata("design:type", String)
], GenerateMotionControlDto.prototype, "video_mime_type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Imagem de substituição em base64' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], GenerateMotionControlDto.prototype, "image", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'MIME type da imagem',
        enum: ['image/jpeg', 'image/png', 'image/webp'],
        default: 'image/jpeg',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(['image/jpeg', 'image/png', 'image/webp']),
    __metadata("design:type", String)
], GenerateMotionControlDto.prototype, "image_mime_type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Resolução do vídeo gerado',
        enum: ['480p', '580p', '720p'],
        default: '480p',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(['480p', '580p', '720p']),
    __metadata("design:type", String)
], GenerateMotionControlDto.prototype, "resolution", void 0);
//# sourceMappingURL=generate-motion-control.dto.js.map