import { PrismaService } from '../prisma/prisma.service';
import { GalleryFiltersDto } from './dto/gallery-filters.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { GalleryItemDto } from './dto/gallery-item.dto';
import { GalleryStatsResponseDto } from './dto/gallery-stats-response.dto';
export declare class GalleryService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getGallery(userId: string, filters: GalleryFiltersDto): Promise<PaginatedResponseDto<GalleryItemDto>>;
    getStats(userId: string): Promise<GalleryStatsResponseDto>;
}
