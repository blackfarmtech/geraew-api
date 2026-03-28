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
exports.AdminStatsResponseDto = exports.GenerationsByProviderDto = exports.KieBreakdownDto = exports.GenerationsByStatusDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class GenerationsByStatusDto {
    pending;
    processing;
    completed;
    failed;
}
exports.GenerationsByStatusDto = GenerationsByStatusDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], GenerationsByStatusDto.prototype, "pending", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], GenerationsByStatusDto.prototype, "processing", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], GenerationsByStatusDto.prototype, "completed", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], GenerationsByStatusDto.prototype, "failed", void 0);
class KieBreakdownDto {
    nanoBanana2;
    nanoBananaPro;
    kling;
}
exports.KieBreakdownDto = KieBreakdownDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Generations using Nano Banana 2' }),
    __metadata("design:type", Number)
], KieBreakdownDto.prototype, "nanoBanana2", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Generations using Nano Banana Pro' }),
    __metadata("design:type", Number)
], KieBreakdownDto.prototype, "nanoBananaPro", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Generations using Kling 2.6 Motion Control' }),
    __metadata("design:type", Number)
], KieBreakdownDto.prototype, "kling", void 0);
class GenerationsByProviderDto {
    geraew;
    kie;
    kieBreakdown;
}
exports.GenerationsByProviderDto = GenerationsByProviderDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Generations via GeraEW provider (Gemini/Veo)' }),
    __metadata("design:type", Number)
], GenerationsByProviderDto.prototype, "geraew", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Generations via KIE API (Nano Banana/Kling)' }),
    __metadata("design:type", Number)
], GenerationsByProviderDto.prototype, "kie", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Breakdown of KIE API generations by model' }),
    __metadata("design:type", KieBreakdownDto)
], GenerationsByProviderDto.prototype, "kieBreakdown", void 0);
class AdminStatsResponseDto {
    totalUsers;
    activeSubscriptions;
    totalRevenueCents;
    totalGenerations;
    generationsByStatus;
    generationsByProvider;
}
exports.AdminStatsResponseDto = AdminStatsResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], AdminStatsResponseDto.prototype, "totalUsers", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], AdminStatsResponseDto.prototype, "activeSubscriptions", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Total revenue in cents (BRL)' }),
    __metadata("design:type", Number)
], AdminStatsResponseDto.prototype, "totalRevenueCents", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], AdminStatsResponseDto.prototype, "totalGenerations", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", GenerationsByStatusDto)
], AdminStatsResponseDto.prototype, "generationsByStatus", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", GenerationsByProviderDto)
], AdminStatsResponseDto.prototype, "generationsByProvider", void 0);
//# sourceMappingURL=admin-stats-response.dto.js.map