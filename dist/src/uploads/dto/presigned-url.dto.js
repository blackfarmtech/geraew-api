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
exports.PresignedUrlDto = exports.UploadPurpose = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
var UploadPurpose;
(function (UploadPurpose) {
    UploadPurpose["GENERATION_INPUT"] = "generation_input";
    UploadPurpose["REFERENCE_VIDEO"] = "reference_video";
})(UploadPurpose || (exports.UploadPurpose = UploadPurpose = {}));
const ALLOWED_CONTENT_TYPES = [
    'image/png',
    'image/jpeg',
    'image/webp',
    'video/mp4',
];
class PresignedUrlDto {
    filename;
    contentType;
    purpose;
}
exports.PresignedUrlDto = PresignedUrlDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'photo.jpg' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], PresignedUrlDto.prototype, "filename", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'image/jpeg',
        enum: ALLOWED_CONTENT_TYPES,
    }),
    (0, class_validator_1.IsEnum)(ALLOWED_CONTENT_TYPES, {
        message: `contentType deve ser um dos seguintes: ${ALLOWED_CONTENT_TYPES.join(', ')}`,
    }),
    __metadata("design:type", String)
], PresignedUrlDto.prototype, "contentType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'generation_input',
        enum: UploadPurpose,
    }),
    (0, class_validator_1.IsEnum)(UploadPurpose),
    __metadata("design:type", String)
], PresignedUrlDto.prototype, "purpose", void 0);
//# sourceMappingURL=presigned-url.dto.js.map