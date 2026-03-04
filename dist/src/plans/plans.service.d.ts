import { PrismaService } from '../prisma/prisma.service';
import { GenerationType, Resolution } from '@prisma/client';
export declare class PlansService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAllPlans(): Promise<{
        id: string;
        slug: string;
        name: string;
        description: string | null;
        priceCents: number;
        creditsPerMonth: number;
        maxConcurrentGenerations: number;
        hasWatermark: boolean;
        galleryRetentionDays: number | null;
        hasApiAccess: boolean;
        isActive: boolean;
        sortOrder: number;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    findPlanBySlug(slug: string): Promise<{
        id: string;
        slug: string;
        name: string;
        description: string | null;
        priceCents: number;
        creditsPerMonth: number;
        maxConcurrentGenerations: number;
        hasWatermark: boolean;
        galleryRetentionDays: number | null;
        hasApiAccess: boolean;
        isActive: boolean;
        sortOrder: number;
        createdAt: Date;
        updatedAt: Date;
    }>;
    findPlanById(id: string): Promise<{
        id: string;
        slug: string;
        name: string;
        description: string | null;
        priceCents: number;
        creditsPerMonth: number;
        maxConcurrentGenerations: number;
        hasWatermark: boolean;
        galleryRetentionDays: number | null;
        hasApiAccess: boolean;
        isActive: boolean;
        sortOrder: number;
        createdAt: Date;
        updatedAt: Date;
    }>;
    getCreditCost(generationType: GenerationType, resolution: Resolution, hasAudio?: boolean): Promise<{
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        generationType: import(".prisma/client").$Enums.GenerationType;
        resolution: import(".prisma/client").$Enums.Resolution;
        hasAudio: boolean;
        creditsPerUnit: number;
        isPerSecond: boolean;
    }>;
    calculateGenerationCost(generationType: GenerationType, resolution: Resolution, durationSeconds?: number, hasAudio?: boolean): Promise<number>;
    findAllPackages(): Promise<{
        id: string;
        name: string;
        priceCents: number;
        isActive: boolean;
        sortOrder: number;
        createdAt: Date;
        credits: number;
    }[]>;
    findPackageById(id: string): Promise<{
        id: string;
        name: string;
        priceCents: number;
        isActive: boolean;
        sortOrder: number;
        createdAt: Date;
        credits: number;
    }>;
}
