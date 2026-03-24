import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { AdminStatsResponseDto } from './dto/admin-stats-response.dto';
export declare class AdminService {
    private readonly prisma;
    constructor(prisma: PrismaService);
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
        inputImages: {
            id: string;
            url: string | null;
            role: import(".prisma/client").$Enums.GenerationImageRole;
            mimeType: string | null;
        }[];
        isFavorited: boolean;
        isDeleted: boolean;
        errorMessage: string | null;
        processingTimeMs: number | null;
        createdAt: Date;
        completedAt: Date | null;
    }>>;
}
