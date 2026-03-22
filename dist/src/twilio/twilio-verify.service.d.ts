import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
export declare class TwilioVerifyService implements OnModuleInit {
    private readonly configService;
    private readonly logger;
    private client;
    private verifyServiceSid;
    constructor(configService: ConfigService);
    onModuleInit(): void;
    sendVerification(phone: string): Promise<void>;
    checkVerification(phone: string, code: string): Promise<string>;
    private formatPhone;
}
