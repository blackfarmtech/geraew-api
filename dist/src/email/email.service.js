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
    logoUrl = '';
    constructor(configService) {
        this.configService = configService;
    }
    onModuleInit() {
        const apiKey = this.configService.get('RESEND_API_KEY');
        this.fromEmail = this.configService.get('RESEND_FROM_EMAIL') || '';
        this.frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:5173';
        this.logoUrl = this.configService.get('LOGO_URL') || '';
        if (!apiKey || !this.fromEmail) {
            this.logger.warn('Resend credentials not configured — email sending will be unavailable');
            return;
        }
        this.client = new resend_1.Resend(apiKey);
        this.logger.log('Resend email service initialized');
    }
    async sendVerificationEmail(to, name, code) {
        if (!this.client) {
            this.logger.warn('Email service not configured — skipping verification email');
            return;
        }
        try {
            const { error } = await this.client.emails.send({
                from: this.fromEmail,
                to: [to],
                subject: 'Seu código de verificação — Geraew',
                html: this.getVerificationTemplate(name, code),
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
    getVerificationTemplate(_name, code) {
        const logoHtml = this.logoUrl
            ? `<img src="${this.logoUrl}" alt="Geraew" width="80" height="80" style="display: block; border-radius: 12px;">`
            : '';
        return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f9f9f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9f9f9; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="padding: 48px 40px;">
              ${logoHtml ? `<div style="margin-bottom: 32px;">${logoHtml}</div>` : ''}
              <h1 style="margin: 0 0 16px; font-size: 24px; font-weight: 700; color: #1a1a1a; line-height: 1.3;">Código de verificação</h1>
              <p style="margin: 0 0 28px; font-size: 15px; color: #666; line-height: 1.6;">Insira o código de verificação abaixo para confirmar seu email:</p>
              <p style="margin: 0 0 28px; font-size: 36px; font-weight: 700; color: #1a1a1a; letter-spacing: 6px; line-height: 1;">${code}</p>
              <p style="margin: 0 0 0; font-size: 15px; color: #666; line-height: 1.6;">Para proteger sua conta, não compartilhe este código.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 40px;">
              <hr style="border: none; border-top: 1px solid #eee; margin: 0 0 24px;">
              <p style="margin: 0 0 6px; font-size: 13px; font-weight: 600; color: #1a1a1a;">Não solicitou este código?</p>
              <p style="margin: 0; font-size: 13px; color: #999; line-height: 1.5;">Se você não criou uma conta no Geraew, ignore este email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
    }
    getPasswordResetTemplate(_name, resetUrl) {
        const logoHtml = this.logoUrl
            ? `<img src="${this.logoUrl}" alt="Geraew" width="80" height="80" style="display: block; border-radius: 12px;">`
            : '';
        return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f9f9f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9f9f9; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="padding: 48px 40px;">
              ${logoHtml ? `<div style="margin-bottom: 32px;">${logoHtml}</div>` : ''}
              <h1 style="margin: 0 0 16px; font-size: 24px; font-weight: 700; color: #1a1a1a; line-height: 1.3;">Redefinição de senha</h1>
              <p style="margin: 0 0 28px; font-size: 15px; color: #666; line-height: 1.6;">Recebemos uma solicitação para redefinir sua senha. Clique no botão abaixo para criar uma nova senha:</p>
              <div style="margin: 0 0 28px;">
                <a href="${resetUrl}"
                   style="display: inline-block; background-color: #1a1a1a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600;">
                  Redefinir Senha
                </a>
              </div>
              <p style="margin: 0; font-size: 15px; color: #666; line-height: 1.6;">Este link é válido por <strong>15 minutos</strong>.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 40px 40px;">
              <hr style="border: none; border-top: 1px solid #eee; margin: 0 0 24px;">
              <p style="margin: 0 0 6px; font-size: 13px; font-weight: 600; color: #1a1a1a;">Não solicitou esta alteração?</p>
              <p style="margin: 0; font-size: 13px; color: #999; line-height: 1.5;">Ignore este email. Sua senha permanecerá a mesma.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
    }
    getWelcomeTemplate(name) {
        const dashboardUrl = `${this.frontendUrl}`;
        const logoHtml = this.logoUrl
            ? `<img src="${this.logoUrl}" alt="Geraew" width="80" height="80" style="display: block; border-radius: 12px;">`
            : '';
        return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f9f9f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9f9f9; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="padding: 48px 40px;">
              ${logoHtml ? `<div style="margin-bottom: 32px;">${logoHtml}</div>` : ''}
              <h1 style="margin: 0 0 16px; font-size: 24px; font-weight: 700; color: #1a1a1a; line-height: 1.3;">Bem-vindo ao Geraew!</h1>
              <p style="margin: 0 0 20px; font-size: 15px; color: #666; line-height: 1.6;">Olá, ${name}! Seu email foi confirmado e sua conta está pronta.</p>
              <p style="margin: 0 0 28px; font-size: 15px; color: #666; line-height: 1.6;">Seu plano Free inclui <strong>30 créditos Mensais</strong> para você explorar a plataforma.</p>
              <div style="margin: 0 0 0;">
                <a href="${dashboardUrl}"
                   style="display: inline-block; background-color: #1a1a1a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600;">
                  Começar a Criar
                </a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
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