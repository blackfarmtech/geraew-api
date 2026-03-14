import { PrismaService } from '../prisma/prisma.service';
import { GenerationType, Resolution } from '@prisma/client';
export declare class PlansService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAllPlans(): Promise<{
        name: string;
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        slug: string;
        description: string | null;
        priceCents: number;
        creditsPerMonth: number;
        maxConcurrentGenerations: number;
        hasWatermark: boolean;
        galleryRetentionDays: number | null;
        hasApiAccess: boolean;
        sortOrder: number;
        stripePriceId: string | null;
    }[]>;
    findPlanBySlug(slug: string): Promise<{
        name: string;
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        slug: string;
        description: string | null;
        priceCents: number;
        creditsPerMonth: number;
        maxConcurrentGenerations: number;
        hasWatermark: boolean;
        galleryRetentionDays: number | null;
        hasApiAccess: boolean;
        sortOrder: number;
        stripePriceId: string | null;
    }>;
    findPlanById(id: string): Promise<{
        name: string;
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        slug: string;
        description: string | null;
        priceCents: number;
        creditsPerMonth: number;
        maxConcurrentGenerations: number;
        hasWatermark: boolean;
        galleryRetentionDays: number | null;
        hasApiAccess: boolean;
        sortOrder: number;
        stripePriceId: string | null;
    }>;
    getCreditCost(generationType: GenerationType, resolution: Resolution, hasAudio: boolean): Promise<{
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
    calculateGenerationCost(generationType: GenerationType, resolution: Resolution, durationSeconds?: number, hasAudio?: boolean, sampleCount?: number): Promise<number>;
    findAllPackages(): Promise<{
        name: string;
        id: string;
        isActive: boolean;
        createdAt: Date;
        priceCents: number;
        sortOrder: number;
        stripePriceId: string | null;
        credits: number;
    }[]>;
    findPackageById(id: string): Promise<{
        name: string;
        id: string;
        isActive: boolean;
        createdAt: Date;
        priceCents: number;
        sortOrder: number;
        stripePriceId: string | null;
        credits: number;
    }>;
}
