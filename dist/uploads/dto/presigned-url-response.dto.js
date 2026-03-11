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
exports.PresignedUrlResponseDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class PresignedUrlResponseDto {
    uploadUrl;
    fileKey;
}
exports.PresignedUrlResponseDto = PresignedUrlResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'https://s3.example.com/...' }),
    __metadata("design:type", String)
], PresignedUrlResponseDto.prototype, "uploadUrl", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'generation_input/550e8400-e29b-41d4-a716-446655440000/photo.jpg' }),
    __metadata("design:type", String)
], PresignedUrlResponseDto.prototype, "fileKey", void 0);
//# sourceMappingURL=presigned-url-response.dto.js.map