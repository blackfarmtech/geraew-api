import { CreditsService } from './credits.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CreditBalanceResponseDto } from './dto/credit-balance-response.dto';
import { CreditTransactionResponseDto } from './dto/credit-transaction-response.dto';
import { EstimateCostDto, EstimateCostResponseDto } from './dto/estimate-cost.dto';
import { PurchaseCreditsDto } from './dto/purchase-credits.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { PlansService } from '../plans/plans.service';
export declare class CreditsController {
    private readonly creditsService;
    private readonly plansService;
    constructor(creditsService: CreditsService, plansService: PlansService);
    getBalance(userId: string): Promise<CreditBalanceResponseDto>;
    getTransactions(userId: string, pagination: PaginationDto): Promise<PaginatedResponseDto<CreditTransactionResponseDto>>;
    getPackages(): Promise<{
        id: string;
        name: string;
        priceCents: number;
        isActive: boolean;
        sortOrder: number;
        createdAt: Date;
        credits: number;
    }[]>;
    purchaseCredits(userId: string, dto: PurchaseCreditsDto): Promise<{
        message: string;
        package: {
            id: string;
            name: string;
            credits: number;
            priceCents: number;
        };
        userId: string;
    }>;
    estimateCost(userId: string, dto: EstimateCostDto): Promise<EstimateCostResponseDto>;
}
