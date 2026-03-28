import { PrismaService } from '../prisma/prisma.service';
import { PlansService } from '../plans/plans.service';
import { CreditTransactionType, GenerationType, Resolution } from '@prisma/client';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { CreditBalanceResponseDto } from './dto/credit-balance-response.dto';
import { CreditTransactionResponseDto } from './dto/credit-transaction-response.dto';
import { EstimateCostResponseDto } from './dto/estimate-cost.dto';
export declare class CreditsService {
    private readonly prisma;
    private readonly plansService;
    constructor(prisma: PrismaService, plansService: PlansService);
    getBalance(userId: string): Promise<CreditBalanceResponseDto>;
    getTransactions(userId: string, pagination: PaginationDto): Promise<PaginatedResponseDto<CreditTransactionResponseDto>>;
    getPackages(): Promise<{
        id: string;
        name: string;
        credits: number;
        priceCents: number;
        isActive: boolean;
        sortOrder: number;
        stripePriceId: string | null;
        createdAt: Date;
    }[]>;
    estimateCost(userId: string, type: GenerationType, resolution: Resolution, durationSeconds?: number, hasAudio?: boolean, sampleCount?: number, modelVariant?: string): Promise<EstimateCostResponseDto>;
    debit(userId: string, amount: number, type: CreditTransactionType, generationId?: string, description?: string): Promise<void>;
    refund(userId: string, amount: number, generationId: string): Promise<void>;
    partialRefund(userId: string, refundAmount: number, generationId: string, description?: string): Promise<void>;
}
