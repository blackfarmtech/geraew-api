import { PrismaService } from '../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
export declare class GalleryCleanupService {
    private readonly prisma;
    private readonly uploadsService;
    private readonly logger;
    constructor(prisma: PrismaService, uploadsService: UploadsService);
    handleGalleryCleanup(): Promise<void>;
    private deleteGenerationFiles;
}
