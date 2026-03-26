import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
export declare class EmailService implements OnModuleInit {
    private readonly configService;
    private readonly logger;
    private client;
    private fromEmail;
    private frontendUrl;
    private logoUrl;
    constructor(configService: ConfigService);
    onModuleInit(): void;
    sendVerificationEmail(to: string, name: string, code: string): Promise<void>;
    sendPasswordResetEmail(to: string, name: string, resetToken: string): Promise<void>;
    sendWelcomeEmail(to: string, name: string): Promise<void>;
    private getVerificationTemplate;
    private getPasswordResetTemplate;
    private getWelcomeTemplate;
}
