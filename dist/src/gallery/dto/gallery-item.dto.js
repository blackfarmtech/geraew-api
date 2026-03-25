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
exports.GalleryItemDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const client_1 = require("@prisma/client");
class GalleryItemDto {
    id;
    type;
    status;
    thumbnailUrl;
    blurDataUrl;
    outputUrl;
    prompt;
    resolution;
    durationSeconds;
    hasAudio;
    hasWatermark;
    creditsConsumed;
    isFavorited;
    outputCount;
    folder;
    createdAt;
    completedAt;
}
exports.GalleryItemDto = GalleryItemDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], GalleryItemDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: client_1.GenerationType }),
    __metadata("design:type", String)
], GalleryItemDto.prototype, "type", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: client_1.GenerationStatus }),
    __metadata("design:type", String)
], GalleryItemDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Thumbnail URL (imagem) ou primeiro output (video)' }),
    __metadata("design:type", String)
], GalleryItemDto.prototype, "thumbnailUrl", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Tiny blurred base64 placeholder for instant loading' }),
    __metadata("design:type", String)
], GalleryItemDto.prototype, "blurDataUrl", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'URL do primeiro output' }),
    __metadata("design:type", String)
], GalleryItemDto.prototype, "outputUrl", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", String)
], GalleryItemDto.prototype, "prompt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: client_1.Resolution }),
    __metadata("design:type", String)
], GalleryItemDto.prototype, "resolution", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", Number)
], GalleryItemDto.prototype, "durationSeconds", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], GalleryItemDto.prototype, "hasAudio", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], GalleryItemDto.prototype, "hasWatermark", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], GalleryItemDto.prototype, "creditsConsumed", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], GalleryItemDto.prototype, "isFavorited", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], GalleryItemDto.prototype, "outputCount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Pasta onde a geração está, se houver',
    }),
    __metadata("design:type", Object)
], GalleryItemDto.prototype, "folder", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Date)
], GalleryItemDto.prototype, "createdAt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", Date)
], GalleryItemDto.prototype, "completedAt", void 0);
//# sourceMappingURL=gallery-item.dto.js.map