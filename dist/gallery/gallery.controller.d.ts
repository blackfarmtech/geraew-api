import { GalleryService } from './gallery.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { GalleryStatsResponseDto } from './dto/gallery-stats-response.dto';
export declare class GalleryController {
    private readonly galleryService;
    constructor(galleryService: GalleryService);
    getGallery(userId: string, pagination: PaginationDto): Promise<import("../common/dto").PaginatedResponseDto<import("../generations/dto/generation-response.dto").GenerationResponseDto>>;
    getStats(userId: string): Promise<GalleryStatsResponseDto>;
}
