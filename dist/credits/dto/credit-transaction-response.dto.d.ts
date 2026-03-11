export declare class CreditTransactionResponseDto {
    id: string;
    type: string;
    amount: number;
    source: string;
    description: string | null;
    generationId: string | null;
    paymentId: string | null;
    createdAt: Date;
}
