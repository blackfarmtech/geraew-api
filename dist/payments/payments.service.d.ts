import { PrismaService } from '../prisma/prisma.service';
import { PaymentStatus, PaymentType, Prisma } from '@prisma/client';
export declare class PaymentsService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    createPayment(userId: string, type: PaymentType, amountCents: number, provider: string, metadata?: Prisma.InputJsonValue): Promise<{
        type: import(".prisma/client").$Enums.PaymentType;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        status: import(".prisma/client").$Enums.PaymentStatus;
        metadata: Prisma.JsonValue | null;
        provider: string;
        amountCents: number;
        currency: string;
        externalPaymentId: string | null;
        externalInvoiceId: string | null;
        subscriptionId: string | null;
        creditPackageId: string | null;
    }>;
    updatePaymentStatus(id: string, status: PaymentStatus, externalPaymentId?: string): Promise<{
        type: import(".prisma/client").$Enums.PaymentType;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        status: import(".prisma/client").$Enums.PaymentStatus;
        metadata: Prisma.JsonValue | null;
        provider: string;
        amountCents: number;
        currency: string;
        externalPaymentId: string | null;
        externalInvoiceId: string | null;
        subscriptionId: string | null;
        creditPackageId: string | null;
    }>;
    findByExternalPaymentId(externalPaymentId: string): Promise<{
        type: import(".prisma/client").$Enums.PaymentType;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        status: import(".prisma/client").$Enums.PaymentStatus;
        metadata: Prisma.JsonValue | null;
        provider: string;
        amountCents: number;
        currency: string;
        externalPaymentId: string | null;
        externalInvoiceId: string | null;
        subscriptionId: string | null;
        creditPackageId: string | null;
    } | null>;
    processSubscriptionPayment(paymentId: string): Promise<void>;
    processCreditPurchase(paymentId: string): Promise<void>;
}
