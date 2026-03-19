export declare class PaymentResponseDto {
    id: string;
    userId: string;
    type: string;
    amountCents: number;
    currency: string;
    status: string;
    provider: string;
    externalPaymentId: string | null;
    externalInvoiceId: string | null;
    subscriptionId: string | null;
    creditPackageId: string | null;
    createdAt: Date;
    updatedAt: Date;
}
