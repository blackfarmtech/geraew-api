import { PrismaService } from '../prisma/prisma.service';
import { GenerationType, Resolution } from '@prisma/client';
export declare class PlansService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAllPlans(): Promise<{
        description: string | null;
        name: string;
        id: string;
        createdAt: Date;
        isActive: boolean;
        updatedAt: Date;
        slug: string;
        priceCents: number;
        creditsPerMonth: number;
        maxConcurrentGenerations: number;
        hasWatermark: boolean;
        galleryRetentionDays: number | null;
        hasApiAccess: boolean;
        sortOrder: number;
    }[]>;
    findPlanBySlug(slug: string): Promise<{
        description: string | null;
        name: string;
        id: string;
        createdAt: Date;
        isActive: boolean;
        updatedAt: Date;
        slug: string;
        priceCents: number;
        creditsPerMonth: number;
        maxConcurrentGenerations: number;
        hasWatermark: boolean;
        galleryRetentionDays: number | null;
        hasApiAccess: boolean;
        sortOrder: number;
    }>;
    findPlanById(id: string): Promise<{
        description: string | null;
        name: string;
        id: string;
        createdAt: Date;
        isActive: boolean;
        updatedAt: Date;
        slug: string;
        priceCents: number;
        creditsPerMonth: number;
        maxConcurrentGenerations: number;
        hasWatermark: boolean;
        galleryRetentionDays: number | null;
        hasApiAccess: boolean;
        sortOrder: number;
    }>;
    getCreditCost(generationType: GenerationType, resolution: Resolution, hasAudio?: boolean): Promise<{
        id: string;
        createdAt: Date;
        isActive: boolean;
        updatedAt: Date;
        generationType: import(".prisma/client").$Enums.GenerationType;
        resolution: import(".prisma/client").$Enums.Resolution;
        hasAudio: boolean;
        creditsPerUnit: number;
        isPerSecond: boolean;
    }>;
    calculateGenerationCost(generationType: GenerationType, resolution: Resolution, durationSeconds?: number, hasAudio?: boolean): Promise<number>;
    findAllPackages(): Promise<{
        name: string;
        id: string;
        createdAt: Date;
        isActive: boolean;
        priceCents: number;
        sortOrder: number;
        credits: number;
    }[]>;
    findPackageById(id: string): Promise<{
        name: string;
        id: string;
        createdAt: Date;
        isActive: boolean;
        priceCents: number;
        sortOrder: number;
        credits: number;
    }>;
}
