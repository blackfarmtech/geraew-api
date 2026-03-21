import { AdminService } from './admin.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { AdjustCreditsDto } from './dto/adjust-credits.dto';
import { AdminStatsResponseDto } from './dto/admin-stats-response.dto';
export declare class AdminController {
    private readonly adminService;
    constructor(adminService: AdminService);
    getStats(): Promise<AdminStatsResponseDto>;
    getUsers(pagination: PaginationDto): Promise<import("../common/dto").PaginatedResponseDto<{
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
            createdAt: Date;
            completedAt: Date | null;
        }[];
    }>;
    adjustCredits(id: string, dto: AdjustCreditsDto): Promise<{
        success: boolean;
        message: string;
    }>;
    getGenerations(pagination: PaginationDto): Promise<import("../common/dto").PaginatedResponseDto<{
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
}
