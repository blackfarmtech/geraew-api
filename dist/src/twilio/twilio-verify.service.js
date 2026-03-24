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
var TwilioVerifyService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TwilioVerifyService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const twilio_1 = require("twilio");
let TwilioVerifyService = TwilioVerifyService_1 = class TwilioVerifyService {
    configService;
    logger = new common_1.Logger(TwilioVerifyService_1.name);
    client = null;
    verifyServiceSid = '';
    constructor(configService) {
        this.configService = configService;
    }
    onModuleInit() {
        const accountSid = this.configService.get('TWILIO_ACCOUNT_SID');
        const authToken = this.configService.get('TWILIO_AUTH_TOKEN');
        this.verifyServiceSid = this.configService.get('TWILIO_VERIFY_SERVICE_SID') || '';
        if (!accountSid || !authToken || !this.verifyServiceSid) {
            this.logger.warn('Twilio credentials not configured — phone verification will be unavailable');
            return;
        }
        this.client = new twilio_1.Twilio(accountSid, authToken);
        this.logger.log('Twilio Verify initialized');
    }
    async sendVerification(phone) {
        if (!this.client) {
            throw new common_1.BadRequestException('Serviço de verificação não configurado');
        }
        const formatted = this.formatPhone(phone);
        try {
            await this.client.verify.v2
                .services(this.verifyServiceSid)
                .verifications.create({
                to: formatted,
                channel: 'sms',
            });
        }
        catch (error) {
            this.logger.error(`Failed to send verification SMS: ${error.message}`);
            if (error.code === 60200) {
                throw new common_1.BadRequestException('Número de telefone inválido');
            }
            if (error.code === 60203) {
                throw new common_1.BadRequestException('Muitas tentativas. Aguarde alguns minutos.');
            }
            throw new common_1.BadRequestException('Erro ao enviar SMS de verificação');
        }
    }
    async checkVerification(phone, code) {
        if (!this.client) {
            throw new common_1.BadRequestException('Serviço de verificação não configurado');
        }
        const formatted = this.formatPhone(phone);
        try {
            const check = await this.client.verify.v2
                .services(this.verifyServiceSid)
                .verificationChecks.create({
                to: formatted,
                code,
            });
            if (check.status !== 'approved') {
                throw new common_1.BadRequestException('Código inválido ou expirado');
            }
            return formatted;
        }
        catch (error) {
            if (error instanceof common_1.BadRequestException)
                throw error;
            this.logger.error(`Verification check failed: ${error.message}`);
            if (error.code === 60200) {
                throw new common_1.BadRequestException('Código inválido ou expirado');
            }
            throw new common_1.BadRequestException('Erro ao verificar código');
        }
    }
    formatPhone(phone) {
        let digits = phone.replace(/\D/g, '');
        if (!digits.startsWith('55')) {
            digits = `55${digits}`;
        }
        return `+${digits}`;
    }
};
exports.TwilioVerifyService = TwilioVerifyService;
exports.TwilioVerifyService = TwilioVerifyService = TwilioVerifyService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], TwilioVerifyService);
//# sourceMappingURL=twilio-verify.service.js.map