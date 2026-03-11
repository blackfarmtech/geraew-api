import { PrismaService } from '../prisma/prisma.service';
export declare class PaymentRetryService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    handlePaymentRetry(): Promise<void>;
    private retryPayment;
    private downgradeToFree;
}
