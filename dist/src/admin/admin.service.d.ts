import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { AdminStatsResponseDto } from './dto/admin-stats-response.dto';
export declare class AdminService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private static readonly GERAEW_MODEL_PREFIXES;
    private static readonly API_COST_MAP;
    private isGeraewModel;
    getStats(): Promise<AdminStatsResponseDto>;
    getUsers(pagination: PaginationDto): Promise<PaginatedResponseDto<{
        id: string;
        email: string;
        name: string;
        role: import(".prisma/client").$Enums.UserRole;
        isActive: boolean;
        createdAt: Date;
        subscription: {
            planSlug: string;
            planName: string;
            status: import(".prisma/client").$Enums.SubscriptionStatus;
        } | null;
        credits: {
            planCreditsRemaining: number;
            bonusCreditsRemaining: number;
        } | null;
    }>>;
    getUserById(id: string): Promise<{
        id: string;
        email: string;
        name: string;
        avatarUrl: string | null;
        role: import(".prisma/client").$Enums.UserRole;
        isActive: boolean;
        emailVerified: boolean;
        oauthProvider: string | null;
        createdAt: Date;
        updatedAt: Date;
        subscription: {
            id: string;
            planSlug: string;
            planName: string;
            status: import(".prisma/client").$Enums.SubscriptionStatus;
            currentPeriodStart: Date;
            currentPeriodEnd: Date;
            cancelAtPeriodEnd: boolean;
        } | null;
        credits: {
            planCreditsRemaining: number;
            bonusCreditsRemaining: number;
            planCreditsUsed: number;
            periodStart: Date | null;
            periodEnd: Date | null;
        } | null;
        recentGenerations: {
            id: string;
            type: import(".prisma/client").$Enums.GenerationType;
            status: import(".prisma/client").$Enums.GenerationStatus;
            prompt: string | null;
            resolution: import(".prisma/client").$Enums.Resolution;
            creditsConsumed: number;
            outputs: {
                url: string;
                thumbnailUrl: string | null;
                mimeType: string | null;
            }[];
            createdAt: Date;
            completedAt: Date | null;
        }[];
    }>;
    adjustCredits(userId: string, amount: number, description: string): Promise<void>;
    changeUserPlan(userId: string, planSlug: string): Promise<void>;
    getGenerations(pagination: PaginationDto): Promise<PaginatedResponseDto<{
        id: string;
        user: {
            name: string;
            email: string;
            id: string;
        };
        type: import(".prisma/client").$Enums.GenerationType;
        status: import(".prisma/client").$Enums.GenerationStatus;
        prompt: string | null;
        resolution: import(".prisma/client").$Enums.Resolution;
        durationSeconds: number | null;
        hasAudio: boolean;
        creditsConsumed: number;
        outputUrls: string[];
        errorMessage: string | null;
        processingTimeMs: number | null;
        createdAt: Date;
        completedAt: Date | null;
    }>>;
    toggleUserStatus(userId: string, isActive: boolean): Promise<void>;
    deleteUser(userId: string): Promise<void>;
    getProviderStats(): Promise<{
        providers: {
            provider: string;
            total: number;
            completed: number;
            failed: number;
            creditsConsumed: number;
        }[];
    }>;
    getUserGenerations(userId: string, pagination: PaginationDto): Promise<PaginatedResponseDto<{
        id: string;
        type: import(".prisma/client").$Enums.GenerationType;
        status: import(".prisma/client").$Enums.GenerationStatus;
        prompt: string | null;
        negativePrompt: string | null;
        resolution: import(".prisma/client").$Enums.Resolution;
        durationSeconds: number | null;
        hasAudio: boolean;
        modelUsed: string;
        creditsConsumed: number;
        outputs: {
            id: string;
            url: string;
            thumbnailUrl: string | null;
            mimeType: string | null;
        }[];
        inputImages: never[];
        isFavorited: boolean;
        isDeleted: boolean;
        errorMessage: string | null;
        processingTimeMs: number | null;
        createdAt: Date;
        completedAt: Date | null;
    }>>;
    getFinancialStats(days: number): Promise<{
        mrrCents: number;
        dailyRevenue: {
            date: string;
            revenueCents: number;
        }[];
        revenueByPlan: {
            planName: string;
            planSlug: string;
            revenueCents: number;
            paymentCount: number;
        }[];
        boostSales: {
            name: string;
            credits: number;
            priceCents: number;
            soldCount: number;
            totalRevenueCents: number;
        }[];
        arpuCents: number;
        totalRevenueCents: number;
        totalApiCostCents: number;
        marginPercent: number;
    }>;
    getUserStats(days: number): Promise<{
        newUsersToday: number;
        newUsersWeek: number;
        newUsersMonth: number;
        dailyNewUsers: {
            date: string;
            count: number;
        }[];
        planDistribution: {
            planName: string;
            planSlug: string;
            userCount: number;
        }[];
        paidUsers: number;
        canceledRecently: number;
        topConsumers: {
            userId: string;
            email: string;
            name: string;
            totalCredits: number;
        }[];
        inactiveUsers: number;
        totalUsers: number;
        conversionRate: number;
        churnRate: number;
    }>;
    getUsageStats(days: number): Promise<{
        dailyGenerations: {
            date: string;
            count: number;
        }[];
        byType: {
            type: import(".prisma/client").$Enums.GenerationType;
            count: number;
        }[];
        avgProcessingByModel: {
            modelUsed: string;
            avgMs: number;
            p95Ms: number;
            count: number;
        }[];
        errorRateByModel: {
            modelUsed: string;
            total: number;
            failed: number;
            errorRate: number;
        }[];
        peakHours: {
            hour: number;
            count: number;
        }[];
        stuckGenerations: {
            id: string;
            userId: string;
            type: import(".prisma/client").$Enums.GenerationType;
            modelUsed: string;
            createdAt: Date;
            processingStartedAt: Date | null;
        }[];
    }>;
    getCreditStats(days: number): Promise<{
        consumedToday: number;
        consumedWeek: number;
        consumedMonth: number;
        dailyConsumption: {
            date: string;
            consumed: number;
        }[];
        allocationVsUsage: {
            totalAllocated: number;
            totalUsed: number;
            usagePercent: number;
        };
        nearLimitUsers: {
            userId: string;
            email: string;
            name: string;
            planCreditsRemaining: number;
            creditsPerMonth: number;
            usagePercent: number;
        }[];
        refunds: {
            totalAmount: number;
            count: number;
        };
    }>;
    getHealthStats(): Promise<{
        queue: {
            processing: number;
            pending: number;
        };
        stuckCount: number;
        recentFailuresByModel: {
            modelUsed: string;
            failedCount: number;
            errorCodes: string[];
        }[];
        failingPayments: number;
        recentErrors: {
            id: string;
            userId: string;
            type: import(".prisma/client").$Enums.GenerationType;
            modelUsed: string;
            errorMessage: string | null;
            errorCode: string | null;
            createdAt: Date;
        }[];
        alerts: {
            level: "warning" | "critical";
            message: string;
        }[];
    }>;
}
