import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
export declare class WebhookLogsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(provider: string, eventType: string, externalId: string | null, payload: Prisma.InputJsonValue): Promise<{
        error: string | null;
        id: string;
        createdAt: Date;
        provider: string;
        eventType: string;
        externalId: string | null;
        payload: Prisma.JsonValue;
        processed: boolean;
    }>;
    markProcessed(id: string): Promise<{
        error: string | null;
        id: string;
        createdAt: Date;
        provider: string;
        eventType: string;
        externalId: string | null;
        payload: Prisma.JsonValue;
        processed: boolean;
    }>;
    markFailed(id: string, error: string): Promise<{
        error: string | null;
        id: string;
        createdAt: Date;
        provider: string;
        eventType: string;
        externalId: string | null;
        payload: Prisma.JsonValue;
        processed: boolean;
    }>;
    findByExternalId(externalId: string): Promise<{
        error: string | null;
        id: string;
        createdAt: Date;
        provider: string;
        eventType: string;
        externalId: string | null;
        payload: Prisma.JsonValue;
        processed: boolean;
    } | null>;
}
