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
exports.SubscriptionResponseDto = exports.ScheduledPlanDto = exports.SubscriptionPlanDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class SubscriptionPlanDto {
    id;
    slug;
    name;
    priceCents;
    creditsPerMonth;
    maxConcurrentGenerations;
    hasWatermark;
    galleryRetentionDays;
    hasApiAccess;
}
exports.SubscriptionPlanDto = SubscriptionPlanDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], SubscriptionPlanDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], SubscriptionPlanDto.prototype, "slug", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], SubscriptionPlanDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SubscriptionPlanDto.prototype, "priceCents", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SubscriptionPlanDto.prototype, "creditsPerMonth", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SubscriptionPlanDto.prototype, "maxConcurrentGenerations", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], SubscriptionPlanDto.prototype, "hasWatermark", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", Object)
], SubscriptionPlanDto.prototype, "galleryRetentionDays", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], SubscriptionPlanDto.prototype, "hasApiAccess", void 0);
class ScheduledPlanDto {
    id;
    slug;
    name;
    priceCents;
    creditsPerMonth;
}
exports.ScheduledPlanDto = ScheduledPlanDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ScheduledPlanDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ScheduledPlanDto.prototype, "slug", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], ScheduledPlanDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ScheduledPlanDto.prototype, "priceCents", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], ScheduledPlanDto.prototype, "creditsPerMonth", void 0);
class SubscriptionResponseDto {
    id;
    status;
    currentPeriodStart;
    currentPeriodEnd;
    cancelAtPeriodEnd;
    paymentProvider;
    paymentRetryCount;
    createdAt;
    plan;
    scheduledPlan;
}
exports.SubscriptionResponseDto = SubscriptionResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], SubscriptionResponseDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], SubscriptionResponseDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Date)
], SubscriptionResponseDto.prototype, "currentPeriodStart", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Date)
], SubscriptionResponseDto.prototype, "currentPeriodEnd", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], SubscriptionResponseDto.prototype, "cancelAtPeriodEnd", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", Object)
], SubscriptionResponseDto.prototype, "paymentProvider", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SubscriptionResponseDto.prototype, "paymentRetryCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Date)
], SubscriptionResponseDto.prototype, "createdAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", SubscriptionPlanDto)
], SubscriptionResponseDto.prototype, "plan", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", ScheduledPlanDto)
], SubscriptionResponseDto.prototype, "scheduledPlan", void 0);
//# sourceMappingURL=subscription-response.dto.js.map