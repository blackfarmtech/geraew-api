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
var EmailService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const resend_1 = require("resend");
let EmailService = EmailService_1 = class EmailService {
    configService;
    logger = new common_1.Logger(EmailService_1.name);
    client = null;
    fromEmail = '';
    frontendUrl = '';
    constructor(configService) {
        this.configService = configService;
    }
    onModuleInit() {
        const apiKey = this.configService.get('RESEND_API_KEY');
        this.fromEmail = this.configService.get('RESEND_FROM_EMAIL') || '';
        this.frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:5173';
        if (!apiKey || !this.fromEmail) {
            this.logger.warn('Resend credentials not configured — email sending will be unavailable');
            return;
        }
        this.client = new resend_1.Resend(apiKey);
        this.logger.log('Resend email service initialized');
    }
    async sendVerificationEmail(to, name, verificationToken) {
        if (!this.client) {
            this.logger.warn('Email service not configured — skipping verification email');
            return;
        }
        const verifyUrl = `${this.frontendUrl}/verify-email?token=${verificationToken}`;
        try {
            const { error } = await this.client.emails.send({
                from: this.fromEmail,
                to: [to],
                subject: 'Confirme seu email — Geraew',
                html: this.getVerificationTemplate(name, verifyUrl),
            });
            if (error) {
                this.logger.error(`Failed to send verification email to ${to}: ${JSON.stringify(error)}`);
                return;
            }
            this.logger.log(`Verification email sent to ${to}`);
        }
        catch (error) {
            this.logger.error(`Failed to send verification email: ${error.message}`);
        }
    }
    async sendPasswordResetEmail(to, name, resetToken) {
        if (!this.client) {
            this.logger.warn('Email service not configured — skipping password reset email');
            return;
        }
        const resetUrl = `${this.frontendUrl}/reset-password?token=${resetToken}`;
        try {
            const { error } = await this.client.emails.send({
                from: this.fromEmail,
                to: [to],
                subject: 'Redefinição de senha — Geraew',
                html: this.getPasswordResetTemplate(name, resetUrl),
            });
            if (error) {
                this.logger.error(`Failed to send password reset email to ${to}: ${JSON.stringify(error)}`);
                return;
            }
            this.logger.log(`Password reset email sent to ${to}`);
        }
        catch (error) {
            this.logger.error(`Failed to send password reset email: ${error.message}`);
        }
    }
    async sendWelcomeEmail(to, name) {
        if (!this.client) {
            this.logger.warn('Email service not configured — skipping welcome email');
            return;
        }
        try {
            const { error } = await this.client.emails.send({
                from: this.fromEmail,
                to: [to],
                subject: 'Bem-vindo ao Geraew!',
                html: this.getWelcomeTemplate(name),
            });
            if (error) {
                this.logger.error(`Failed to send welcome email to ${to}: ${JSON.stringify(error)}`);
                return;
            }
            this.logger.log(`Welcome email sent to ${to}`);
        }
        catch (error) {
            this.logger.error(`Failed to send welcome email: ${error.message}`);
        }
    }
    getVerificationTemplate(name, verifyUrl) {
        return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <h2 style="color: #7c3aed;">Geraew</h2>
  <p>Olá, ${name}!</p>
  <p>Obrigado por se cadastrar. Para ativar sua conta, confirme seu email clicando no botão abaixo:</p>
  <div style="text-align: center; margin: 30px 0;">
    <a href="${verifyUrl}"
       style="background-color: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
      Confirmar Email
    </a>
  </div>
  <p>Este link é válido por <strong>24 horas</strong>.</p>
  <p>Se você não criou uma conta no Geraew, ignore este email.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  <p style="font-size: 12px; color: #999;">Geraew — Geração de imagens e vídeos com IA</p>
</body>
</html>`;
    }
    getPasswordResetTemplate(name, resetUrl) {
        return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <h2 style="color: #7c3aed;">Geraew</h2>
  <p>Olá, ${name}!</p>
  <p>Recebemos uma solicitação para redefinir sua senha. Clique no botão abaixo para criar uma nova senha:</p>
  <div style="text-align: center; margin: 30px 0;">
    <a href="${resetUrl}"
       style="background-color: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
      Redefinir Senha
    </a>
  </div>
  <p>Este link é válido por <strong>15 minutos</strong>.</p>
  <p>Se você não solicitou esta alteração, ignore este email. Sua senha permanecerá a mesma.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  <p style="font-size: 12px; color: #999;">Geraew — Geração de imagens e vídeos com IA</p>
</body>
</html>`;
    }
    getWelcomeTemplate(name) {
        const dashboardUrl = `${this.frontendUrl}/dashboard`;
        return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <h2 style="color: #7c3aed;">Bem-vindo ao Geraew!</h2>
  <p>Olá, ${name}!</p>
  <p>Seu email foi confirmado e sua conta está pronta. Você já pode começar a gerar imagens e vídeos incríveis com inteligência artificial.</p>
  <p>Seu plano Free inclui <strong>30 créditos por dia</strong> para você explorar a plataforma.</p>
  <div style="text-align: center; margin: 30px 0;">
    <a href="${dashboardUrl}"
       style="background-color: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
      Começar a Criar
    </a>
  </div>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  <p style="font-size: 12px; color: #999;">Geraew — Geração de imagens e vídeos com IA</p>
</body>
</html>`;
    }
};
exports.EmailService = EmailService;
exports.EmailService = EmailService = EmailService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], EmailService);
//# sourceMappingURL=email.service.js.map