import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
  Sse,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Observable, map, merge, interval } from 'rxjs';
import { GenerationsService } from './generations.service';
import { GenerationEventsService } from './generation-events.service';
import { CurrentUser } from '../common/decorators';
import { GenerationFiltersDto } from './dto/generation-filters.dto';
import {
  GenerationResponseDto,
  CreateGenerationResponseDto,
} from './dto/generation-response.dto';
import { FolderResponseDto } from '../folders/dto/folder-response.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { GenerateImageDto } from './dto/generate-image.dto';
import { GenerateImageNanoBananaDto } from './dto/generate-image-nano-banana.dto';
import { GenerateVideoTextToVideoDto } from './dto/videos/generate-video-text-to-video.dto';
import { GenerateVideoImageToVideoDto } from './dto/videos/generate-video-image-to-video.dto';
import { GenerateVideoWithReferencesDto } from './dto/videos/generate-video-with-references.dto';
import { GenerateMotionControlDto } from './dto/videos/generate-motion-control.dto';

@ApiTags('generations')
@ApiBearerAuth()
@Controller('api/v1/generations')
export class GenerationsController {
  constructor(
    private readonly generationsService: GenerationsService,
    private readonly generationEvents: GenerationEventsService,
  ) {}

  @Sse('events')
  @ApiOperation({ summary: 'SSE — recebe eventos de todas as gerações do usuário em tempo real' })
  sseAll(@CurrentUser('sub') userId: string): Observable<MessageEvent> {
    const events$ = this.generationEvents.subscribe(userId).pipe(
      map((event: any) => ({ data: event } as MessageEvent)),
    );
    const heartbeat$ = interval(20_000).pipe(
      map(() => ({ data: { type: 'heartbeat' } } as unknown as MessageEvent)),
    );
    return merge(events$, heartbeat$);
  }

  @Sse(':id/events')
  @ApiOperation({ summary: 'SSE — recebe eventos de uma geração específica em tempo real' })
  @ApiParam({ name: 'id', description: 'ID da geração' })
  sseOne(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Observable<MessageEvent> {
    const events$ = this.generationEvents.subscribeToGeneration(userId, id).pipe(
      map((event: any) => ({ data: event } as MessageEvent)),
    );
    const heartbeat$ = interval(20_000).pipe(
      map(() => ({ data: { type: 'heartbeat' } } as unknown as MessageEvent)),
    );
    return merge(events$, heartbeat$);
  }

  @Post('generate-image')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Gera imagem (text-to-image ou image-to-image)' })
  @ApiResponse({ status: 201, type: CreateGenerationResponseDto })
  async generateImage(
    @CurrentUser('sub') userId: string,
    @Body() dto: GenerateImageDto,
  ): Promise<CreateGenerationResponseDto> {
    return this.generationsService.generateImage(userId, dto);
  }

  @Post('generate-image-auto')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({
    summary:
      'Gera imagem tentando Geraew (Gemini) primeiro; se falhar, usa Nano Banana 2 como fallback',
  })
  @ApiResponse({ status: 201, type: CreateGenerationResponseDto })
  async generateImageWithFallback(
    @CurrentUser('sub') userId: string,
    @Body() dto: GenerateImageDto,
  ): Promise<CreateGenerationResponseDto> {
    return this.generationsService.generateImageWithFallback(userId, dto);
  }

  @Post('generate-image-nano-banana')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Gera imagem via Nano Banana 2 (kie-api) — text-to-image ou image-to-image' })
  @ApiResponse({ status: 201, type: CreateGenerationResponseDto })
  async generateImageNanoBanana(
    @CurrentUser('sub') userId: string,
    @Body() dto: GenerateImageNanoBananaDto,
  ): Promise<CreateGenerationResponseDto> {
    return this.generationsService.generateImageNanoBanana(userId, dto);
  }

  @Post('text-to-video')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Gera vídeo a partir de texto' })
  @ApiResponse({ status: 201, type: CreateGenerationResponseDto })
  async textToVideo(
    @CurrentUser('sub') userId: string,
    @Body() dto: GenerateVideoTextToVideoDto,
  ): Promise<CreateGenerationResponseDto> {
    return this.generationsService.generateTextToVideo(userId, dto);
  }

  @Post('image-to-video')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Gera vídeo a partir de imagem' })
  @ApiResponse({ status: 201, type: CreateGenerationResponseDto })
  async imageToVideo(
    @CurrentUser('sub') userId: string,
    @Body() dto: GenerateVideoImageToVideoDto,
  ): Promise<CreateGenerationResponseDto> {
    return this.generationsService.generateImageToVideo(userId, dto);
  }

  @Post('video-with-references')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Gera vídeo com imagens de referência' })
  @ApiResponse({ status: 201, type: CreateGenerationResponseDto })
  async videoWithReferences(
    @CurrentUser('sub') userId: string,
    @Body() dto: GenerateVideoWithReferencesDto,
  ): Promise<CreateGenerationResponseDto> {
    return this.generationsService.generateVideoWithReferences(userId, dto);
  }

  @Post('motion-control')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Motion Control — Wan Animate Replace (vídeo + imagem → vídeo)' })
  @ApiResponse({ status: 201, type: CreateGenerationResponseDto })
  async motionControl(
    @CurrentUser('sub') userId: string,
    @Body() dto: GenerateMotionControlDto,
  ): Promise<CreateGenerationResponseDto> {
    return this.generationsService.generateMotionControl(userId, dto);
  }

  @Get()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Lista gerações do usuário (paginado, com filtros)' })
  @ApiResponse({ status: 200 })
  async findAll(
    @CurrentUser('sub') userId: string,
    @Query() filters: GenerationFiltersDto,
  ): Promise<PaginatedResponseDto<GenerationResponseDto>> {
    return this.generationsService.findAll(userId, filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Status e detalhes de uma geração' })
  @ApiResponse({ status: 200, type: GenerationResponseDto })
  @ApiParam({ name: 'id', description: 'ID da geração' })
  async findById(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<GenerationResponseDto> {
    return this.generationsService.findById(userId, id);
  }

  @Get(':id/folders')
  @ApiOperation({ summary: 'Lista as pastas em que uma geração está' })
  @ApiResponse({ status: 200, type: [FolderResponseDto] })
  @ApiParam({ name: 'id', description: 'ID da geração' })
  async findFolders(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<FolderResponseDto[]> {
    return this.generationsService.findFolders(userId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete — remove da galeria' })
  @ApiResponse({ status: 204, description: 'Geração removida com sucesso' })
  @ApiParam({ name: 'id', description: 'ID da geração' })
  async softDelete(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<void> {
    return this.generationsService.softDelete(userId, id);
  }

  @Delete(':id/outputs/:outputId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deleta um output específico de uma geração' })
  @ApiResponse({ status: 204, description: 'Output removido com sucesso' })
  @ApiParam({ name: 'id', description: 'ID da geração' })
  @ApiParam({ name: 'outputId', description: 'ID do output' })
  async deleteOutput(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Param('outputId') outputId: string,
  ): Promise<void> {
    return this.generationsService.deleteOutput(userId, id, outputId);
  }

  @Post(':id/favorite')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Marca geração como favorita' })
  @ApiResponse({ status: 204, description: 'Marcado como favorito' })
  @ApiParam({ name: 'id', description: 'ID da geração' })
  async addFavorite(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<void> {
    return this.generationsService.toggleFavorite(userId, id, true);
  }

  @Delete(':id/favorite')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove geração dos favoritos' })
  @ApiResponse({ status: 204, description: 'Removido dos favoritos' })
  @ApiParam({ name: 'id', description: 'ID da geração' })
  async removeFavorite(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<void> {
    return this.generationsService.toggleFavorite(userId, id, false);
  }
}
