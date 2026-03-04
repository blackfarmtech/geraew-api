import { GenerationsService } from './generations.service';
import { TextToImageDto } from './dto/text-to-image.dto';
import { ImageToImageDto } from './dto/image-to-image.dto';
import { TextToVideoDto } from './dto/text-to-video.dto';
import { ImageToVideoDto } from './dto/image-to-video.dto';
import { MotionControlDto } from './dto/motion-control.dto';
import { GenerationFiltersDto } from './dto/generation-filters.dto';
import { GenerationResponseDto, CreateGenerationResponseDto } from './dto/generation-response.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
export declare class GenerationsController {
    private readonly generationsService;
    constructor(generationsService: GenerationsService);
    textToImage(userId: string, dto: TextToImageDto): Promise<CreateGenerationResponseDto>;
    imageToImage(userId: string, dto: ImageToImageDto): Promise<CreateGenerationResponseDto>;
    textToVideo(userId: string, dto: TextToVideoDto): Promise<CreateGenerationResponseDto>;
    imageToVideo(userId: string, dto: ImageToVideoDto): Promise<CreateGenerationResponseDto>;
    motionControl(userId: string, dto: MotionControlDto): Promise<CreateGenerationResponseDto>;
    findAll(userId: string, filters: GenerationFiltersDto): Promise<PaginatedResponseDto<GenerationResponseDto>>;
    findById(userId: string, id: string): Promise<GenerationResponseDto>;
    softDelete(userId: string, id: string): Promise<void>;
    addFavorite(userId: string, id: string): Promise<void>;
    removeFavorite(userId: string, id: string): Promise<void>;
}
