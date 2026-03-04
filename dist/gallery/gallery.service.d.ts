import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { GenerationResponseDto } from '../generations/dto/generation-response.dto';
import { GalleryStatsResponseDto } from './dto/gallery-stats-response.dto';
export declare class GalleryService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getGallery(userId: string, pagination: PaginationDto): Promise<PaginatedResponseDto<GenerationResponseDto>>;
    getStats(userId: string): Promise<GalleryStatsResponseDto>;
}
