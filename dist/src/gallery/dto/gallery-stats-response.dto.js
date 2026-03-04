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
exports.GalleryStatsResponseDto = exports.GenerationsByTypeDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class GenerationsByTypeDto {
    TEXT_TO_IMAGE;
    IMAGE_TO_IMAGE;
    TEXT_TO_VIDEO;
    IMAGE_TO_VIDEO;
    MOTION_CONTROL;
}
exports.GenerationsByTypeDto = GenerationsByTypeDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], GenerationsByTypeDto.prototype, "TEXT_TO_IMAGE", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], GenerationsByTypeDto.prototype, "IMAGE_TO_IMAGE", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], GenerationsByTypeDto.prototype, "TEXT_TO_VIDEO", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], GenerationsByTypeDto.prototype, "IMAGE_TO_VIDEO", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], GenerationsByTypeDto.prototype, "MOTION_CONTROL", void 0);
class GalleryStatsResponseDto {
    totalGenerations;
    totalCreditsUsed;
    generationsByType;
    favoriteCount;
}
exports.GalleryStatsResponseDto = GalleryStatsResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], GalleryStatsResponseDto.prototype, "totalGenerations", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], GalleryStatsResponseDto.prototype, "totalCreditsUsed", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: GenerationsByTypeDto }),
    __metadata("design:type", GenerationsByTypeDto)
], GalleryStatsResponseDto.prototype, "generationsByType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], GalleryStatsResponseDto.prototype, "favoriteCount", void 0);
//# sourceMappingURL=gallery-stats-response.dto.js.map