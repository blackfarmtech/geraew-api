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
var MercadoPagoWebhookService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MercadoPagoWebhookService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const webhook_logs_service_1 = require("../../webhook-logs/webhook-logs.service");
const payments_service_1 = require("../payments.service");
let MercadoPagoWebhookService = MercadoPagoWebhookService_1 = class MercadoPagoWebhookService {
    configService;
    webhookLogsService;
    paymentsService;
    logger = new common_1.Logger(MercadoPagoWebhookService_1.name);
    constructor(configService, webhookLogsService, paymentsService) {
        this.configService = configService;
        this.webhookLogsService = webhookLogsService;
        this.paymentsService = paymentsService;
    }
    async handleWebhook(payload) {
        const webhookSecret = this.configService.get('MERCADOPAGO_WEBHOOK_SECRET');
        if (!webhookSecret) {
            this.logger.warn('MERCADOPAGO_WEBHOOK_SECRET not configured');
        }
        if (!payload || typeof payload !== 'object') {
            throw new common_1.BadRequestException('Invalid webhook payload');
        }
        const eventType = payload.type ?? payload.action ?? 'unknown';
        const externalId = payload.data?.id?.toString() ?? payload.id ?? null;
        const log = await this.webhookLogsService.create('mercadopago', eventType, externalId, payload);
        try {
            await this.routeEvent(eventType, payload);
            await this.webhookLogsService.markProcessed(log.id);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            await this.webhookLogsService.markFailed(log.id, message);
            this.logger.error(`Failed to process MercadoPago event ${eventType}`, message);
        }
    }
    async routeEvent(eventType, payload) {
        switch (eventType) {
            case 'payment':
                this.logger.log(`MercadoPago payment event: ${payload.data?.id ?? 'unknown'}`);
                break;
            case 'subscription_preapproval':
                this.logger.log(`MercadoPago subscription event: ${payload.data?.id ?? 'unknown'}`);
                break;
            default:
                this.logger.log(`Unhandled MercadoPago event type: ${eventType}`);
        }
    }
};
exports.MercadoPagoWebhookService = MercadoPagoWebhookService;
exports.MercadoPagoWebhookService = MercadoPagoWebhookService = MercadoPagoWebhookService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        webhook_logs_service_1.WebhookLogsService,
        payments_service_1.PaymentsService])
], MercadoPagoWebhookService);
//# sourceMappingURL=mercadopago-webhook.service.js.map