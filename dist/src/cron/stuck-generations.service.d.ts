import { PrismaService } from '../prisma/prisma.service';
export declare class StuckGenerationsService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    handleStuckGenerations(): Promise<void>;
    private failAndRefund;
}
