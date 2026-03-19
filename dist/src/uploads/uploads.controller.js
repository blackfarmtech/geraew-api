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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const uploads_service_1 = require("./uploads.service");
const presigned_url_dto_1 = require("./dto/presigned-url.dto");
const presigned_url_response_dto_1 = require("./dto/presigned-url-response.dto");
let UploadsController = class UploadsController {
    uploadsService;
    constructor(uploadsService) {
        this.uploadsService = uploadsService;
    }
    async generatePresignedUrl(dto) {
        return this.uploadsService.generatePresignedUrl(dto);
    }
};
exports.UploadsController = UploadsController;
__decorate([
    (0, common_1.Post)('presigned-url'),
    (0, swagger_1.ApiOperation)({ summary: 'Gera URL pré-assinada para upload no S3/R2' }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: 'URL pré-assinada gerada com sucesso',
        type: presigned_url_response_dto_1.PresignedUrlResponseDto,
    }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [presigned_url_dto_1.PresignedUrlDto]),
    __metadata("design:returntype", Promise)
], UploadsController.prototype, "generatePresignedUrl", null);
exports.UploadsController = UploadsController = __decorate([
    (0, swagger_1.ApiTags)('uploads'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('api/v1/uploads'),
    __metadata("design:paramtypes", [uploads_service_1.UploadsService])
], UploadsController);
//# sourceMappingURL=uploads.controller.js.map