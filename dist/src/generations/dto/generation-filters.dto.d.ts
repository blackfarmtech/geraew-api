import { GenerationType, GenerationStatus } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';
export declare class GenerationFiltersDto extends PaginationDto {
    type?: GenerationType;
    status?: GenerationStatus;
    favorited?: boolean;
}
