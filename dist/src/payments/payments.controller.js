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
var PaymentsController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const decorators_1 = require("../common/decorators");
const stripe_webhook_service_1 = require("./webhooks/stripe-webhook.service");
const mercadopago_webhook_service_1 = require("./webhooks/mercadopago-webhook.service");
let PaymentsController = PaymentsController_1 = class PaymentsController {
    stripeWebhookService;
    mercadoPagoWebhookService;
    logger = new common_1.Logger(PaymentsController_1.name);
    constructor(stripeWebhookService, mercadoPagoWebhookService) {
        this.stripeWebhookService = stripeWebhookService;
        this.mercadoPagoWebhookService = mercadoPagoWebhookService;
    }
    async stripeWebhook(req, signature) {
        const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body));
        await this.stripeWebhookService.handleWebhook(rawBody, signature);
        return { received: true };
    }
    async mercadoPagoWebhook(req, signature, payload) {
        if (!signature) {
            throw new common_1.BadRequestException('Missing x-signature header');
        }
        await this.mercadoPagoWebhookService.handleWebhook(payload);
        return { received: true };
    }
};
exports.PaymentsController = PaymentsController;
__decorate([
    (0, decorators_1.Public)(),
    (0, common_1.Post)('stripe'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Stripe webhook endpoint' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Webhook processed' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Invalid payload' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Headers)('stripe-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "stripeWebhook", null);
__decorate([
    (0, decorators_1.Public)(),
    (0, common_1.Post)('mercadopago'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'MercadoPago webhook endpoint' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Webhook processed' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Invalid payload' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Headers)('x-signature')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], PaymentsController.prototype, "mercadoPagoWebhook", null);
exports.PaymentsController = PaymentsController = PaymentsController_1 = __decorate([
    (0, swagger_1.ApiTags)('webhooks'),
    (0, common_1.Controller)('api/v1/webhooks'),
    __metadata("design:paramtypes", [stripe_webhook_service_1.StripeWebhookService,
        mercadopago_webhook_service_1.MercadoPagoWebhookService])
], PaymentsController);
//# sourceMappingURL=payments.controller.js.map