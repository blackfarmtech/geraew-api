import { CreditsService } from './credits.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CreditBalanceResponseDto } from './dto/credit-balance-response.dto';
import { CreditTransactionResponseDto } from './dto/credit-transaction-response.dto';
import { EstimateCostDto, EstimateCostResponseDto } from './dto/estimate-cost.dto';
import { PurchaseCreditsDto } from './dto/purchase-credits.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { PlansService } from '../plans/plans.service';
import { StripeService } from '../payments/stripe.service';
import { PrismaService } from '../prisma/prisma.service';
export declare class CreditsController {
    private readonly creditsService;
    private readonly plansService;
    private readonly stripeService;
    private readonly prisma;
    constructor(creditsService: CreditsService, plansService: PlansService, stripeService: StripeService, prisma: PrismaService);
    getBalance(userId: string): Promise<CreditBalanceResponseDto>;
    getTransactions(userId: string, pagination: PaginationDto): Promise<PaginatedResponseDto<CreditTransactionResponseDto>>;
    getPackages(): Promise<{
        id: string;
        name: string;
        isActive: boolean;
        createdAt: Date;
        priceCents: number;
        sortOrder: number;
        stripePriceId: string | null;
        credits: number;
    }[]>;
    purchaseCredits(userId: string, dto: PurchaseCreditsDto): Promise<{
        checkoutUrl: string;
    }>;
    estimateCost(userId: string, dto: EstimateCostDto): Promise<EstimateCostResponseDto>;
}
