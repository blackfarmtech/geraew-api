import { FoldersService } from './folders.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { AddGenerationsToFolderDto } from './dto/add-generations-to-folder.dto';
import { RemoveGenerationsFromFolderDto } from './dto/remove-generations-from-folder.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
export declare class FoldersController {
    private readonly foldersService;
    constructor(foldersService: FoldersService);
    create(userId: string, dto: CreateFolderDto): Promise<import("./dto/folder-response.dto").FolderResponseDto>;
    findAll(userId: string, pagination: PaginationDto): Promise<import("../common/dto").PaginatedResponseDto<import("./dto/folder-response.dto").FolderResponseDto>>;
    findOne(userId: string, folderId: string, pagination: PaginationDto): Promise<{
        folder: import("./dto/folder-response.dto").FolderResponseDto;
        generations: import("../common/dto").PaginatedResponseDto<import("../generations/dto/generation-response.dto").GenerationResponseDto>;
    }>;
    update(userId: string, folderId: string, dto: UpdateFolderDto): Promise<import("./dto/folder-response.dto").FolderResponseDto>;
    remove(userId: string, folderId: string): Promise<void>;
    addGenerations(userId: string, folderId: string, dto: AddGenerationsToFolderDto): Promise<{
        added: number;
    }>;
    removeGenerations(userId: string, folderId: string, dto: RemoveGenerationsFromFolderDto): Promise<{
        removed: number;
    }>;
}
