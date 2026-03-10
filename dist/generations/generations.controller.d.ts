import { GenerationsService } from './generations.service';
import { GenerationFiltersDto } from './dto/generation-filters.dto';
import { GenerationResponseDto, CreateGenerationResponseDto } from './dto/generation-response.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { GenerateImageDto } from './dto/generate-image.dto';
import { GenerateVideoTextToVideoDto } from './dto/videos/generate-video-text-to-video.dto';
import { GenerateVideoImageToVideoDto } from './dto/videos/generate-video-image-to-video.dto';
import { GenerateVideoWithReferencesDto } from './dto/videos/generate-video-with-references.dto';
export declare class GenerationsController {
    private readonly generationsService;
    constructor(generationsService: GenerationsService);
    generateImage(userId: string, dto: GenerateImageDto): Promise<CreateGenerationResponseDto>;
    textToVideo(userId: string, dto: GenerateVideoTextToVideoDto): Promise<CreateGenerationResponseDto>;
    imageToVideo(userId: string, dto: GenerateVideoImageToVideoDto): Promise<CreateGenerationResponseDto>;
    videoWithReferences(userId: string, dto: GenerateVideoWithReferencesDto): Promise<CreateGenerationResponseDto>;
    findAll(userId: string, filters: GenerationFiltersDto): Promise<PaginatedResponseDto<GenerationResponseDto>>;
    findById(userId: string, id: string): Promise<GenerationResponseDto>;
    softDelete(userId: string, id: string): Promise<void>;
    addFavorite(userId: string, id: string): Promise<void>;
    removeFavorite(userId: string, id: string): Promise<void>;
}
