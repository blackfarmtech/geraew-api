import { VideoEditorService } from './video-editor.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddClipDto } from './dto/add-clip.dto';
import { UpdateClipDto } from './dto/update-clip.dto';
import { ReorderClipsDto } from './dto/reorder-clips.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
export declare class VideoEditorController {
    private readonly videoEditorService;
    constructor(videoEditorService: VideoEditorService);
    createProject(userId: string, dto: CreateProjectDto): Promise<import("./dto/project-response.dto").ProjectResponseDto>;
    listProjects(userId: string, pagination: PaginationDto): Promise<import("../common/dto").PaginatedResponseDto<import("./dto/project-response.dto").ProjectResponseDto>>;
    getProject(userId: string, projectId: string): Promise<import("./dto/project-response.dto").ProjectResponseDto>;
    updateProject(userId: string, projectId: string, dto: UpdateProjectDto): Promise<import("./dto/project-response.dto").ProjectResponseDto>;
    deleteProject(userId: string, projectId: string): Promise<void>;
    addClip(userId: string, projectId: string, dto: AddClipDto): Promise<import("./dto/project-response.dto").ClipResponseDto>;
    updateClip(userId: string, projectId: string, clipId: string, dto: UpdateClipDto): Promise<import("./dto/project-response.dto").ClipResponseDto>;
    deleteClip(userId: string, projectId: string, clipId: string): Promise<void>;
    reorderClips(userId: string, projectId: string, dto: ReorderClipsDto): Promise<import("./dto/project-response.dto").ProjectResponseDto>;
    render(userId: string, projectId: string): Promise<import("./dto/project-response.dto").ProjectResponseDto>;
}
