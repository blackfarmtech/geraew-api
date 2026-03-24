import { GalleryService } from './gallery.service';
import { GalleryFiltersDto } from './dto/gallery-filters.dto';
import { GalleryStatsResponseDto } from './dto/gallery-stats-response.dto';
export declare class GalleryController {
    private readonly galleryService;
    constructor(galleryService: GalleryService);
    getGallery(userId: string, filters: GalleryFiltersDto): Promise<import("../common/dto").PaginatedResponseDto<import("../generations/dto/generation-response.dto").GenerationResponseDto>>;
    getStats(userId: string): Promise<GalleryStatsResponseDto>;
}
