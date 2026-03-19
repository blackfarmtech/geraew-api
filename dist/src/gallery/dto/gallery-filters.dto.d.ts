import { GenerationType } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';
export declare class GalleryFiltersDto extends PaginationDto {
    type?: string;
    favorited?: boolean;
    folderId?: string;
    get typeArray(): GenerationType[] | undefined;
}
