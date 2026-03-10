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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { GenerationsService } from './generations.service';
import { CurrentUser } from '../common/decorators';
import { GenerationFiltersDto } from './dto/generation-filters.dto';
import {
  GenerationResponseDto,
  CreateGenerationResponseDto,
} from './dto/generation-response.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { GenerateImageDto } from './dto/generate-image.dto';
import { GenerateVideoTextToVideoDto } from './dto/videos/generate-video-text-to-video.dto';
import { GenerateVideoImageToVideoDto } from './dto/videos/generate-video-image-to-video.dto';
import { GenerateVideoWithReferencesDto } from './dto/videos/generate-video-with-references.dto';

@ApiTags('generations')
@ApiBearerAuth()
@Controller('api/v1/generations')
export class GenerationsController {
  constructor(private readonly generationsService: GenerationsService) {}

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
