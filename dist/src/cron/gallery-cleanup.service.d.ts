import { PrismaService } from '../prisma/prisma.service';
export declare class GalleryCleanupService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    handleGalleryCleanup(): Promise<void>;
}
