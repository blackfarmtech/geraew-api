import { PrismaService } from '../prisma/prisma.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { FolderResponseDto } from './dto/folder-response.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { GenerationResponseDto } from '../generations/dto/generation-response.dto';
export declare class FoldersService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(userId: string, dto: CreateFolderDto): Promise<FolderResponseDto>;
    findAll(userId: string, pagination: PaginationDto): Promise<PaginatedResponseDto<FolderResponseDto>>;
    findOne(userId: string, folderId: string, pagination: PaginationDto): Promise<{
        folder: FolderResponseDto;
        generations: PaginatedResponseDto<GenerationResponseDto>;
    }>;
    update(userId: string, folderId: string, dto: UpdateFolderDto): Promise<FolderResponseDto>;
    remove(userId: string, folderId: string): Promise<void>;
    addGenerations(userId: string, folderId: string, generationIds: string[]): Promise<{
        added: number;
    }>;
    removeGenerations(userId: string, folderId: string, generationIds: string[]): Promise<{
        removed: number;
    }>;
}
