import { Injectable, BadRequestException, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

@Injectable()
export class TwilioVerifyService implements OnModuleInit {
  private readonly logger = new Logger(TwilioVerifyService.name);
  private client: Twilio | null = null;
  private verifyServiceSid: string = '';

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    this.verifyServiceSid = this.configService.get<string>('TWILIO_VERIFY_SERVICE_SID') || '';

    if (!accountSid || !authToken || !this.verifyServiceSid) {
      this.logger.warn('Twilio credentials not configured — phone verification will be unavailable');
      return;
    }

    this.client = new Twilio(accountSid, authToken);
    this.logger.log('Twilio Verify initialized');
  }

  /**
   * Envia SMS de verificação para o número de telefone
   */
  async sendVerification(phone: string, locale?: string): Promise<void> {
    if (!this.client) {
      throw new BadRequestException('Serviço de verificação não configurado');
    }

    const formatted = this.formatPhone(phone);

    try {
      await this.client.verify.v2
        .services(this.verifyServiceSid)
        .verifications.create({
          to: formatted,
          channel: 'sms',
          locale: this.toTwilioLocale(locale),
        });
    } catch (error: any) {
      this.logger.error(`Failed to send verification SMS: ${error.message}`);

      if (error.code === 60200) {
        throw new BadRequestException('Número de telefone inválido');
      }
      if (error.code === 60203) {
        throw new BadRequestException('Muitas tentativas. Aguarde alguns minutos.');
      }

      throw new BadRequestException('Erro ao enviar SMS de verificação');
    }
  }

  /**
   * Verifica o código SMS e retorna o número verificado
   */
  async checkVerification(phone: string, code: string): Promise<string> {
    if (!this.client) {
      throw new BadRequestException('Serviço de verificação não configurado');
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
        throw new BadRequestException('Código inválido ou expirado');
      }

      return formatted;
    } catch (error: any) {
      if (error instanceof BadRequestException) throw error;

      this.logger.error(`Verification check failed: ${error.message}`);

      if (error.code === 60200) {
        throw new BadRequestException('Código inválido ou expirado');
      }

      throw new BadRequestException('Erro ao verificar código');
    }
  }

  private toTwilioLocale(locale?: string): string {
    if (!locale) return 'en';
    const lower = locale.toLowerCase();
    if (lower === 'pt-br' || lower.startsWith('pt')) return 'pt-br';
    if (lower.startsWith('es')) return 'es';
    if (lower.startsWith('fr')) return 'fr';
    if (lower.startsWith('de')) return 'de';
    if (lower.startsWith('it')) return 'it';
    if (lower.startsWith('nl')) return 'nl';
    return 'en';
  }

  private formatPhone(phone: string): string {
    const trimmed = phone.trim();
    // Se já vem em E.164 (+xx...), valida direto
    if (trimmed.startsWith('+')) {
      const parsed = parsePhoneNumberFromString(trimmed);
      if (!parsed?.isValid()) {
        throw new BadRequestException('Número de telefone inválido');
      }
      return parsed.format('E.164');
    }
    // Sem + = assume BR (retrocompat com usuários legados)
    const digits = trimmed.replace(/\D/g, '');
    const withBr = digits.startsWith('55') ? `+${digits}` : `+55${digits}`;
    const parsed = parsePhoneNumberFromString(withBr);
    if (!parsed?.isValid()) {
      throw new BadRequestException('Número de telefone inválido');
    }
    return parsed.format('E.164');
  }
}
