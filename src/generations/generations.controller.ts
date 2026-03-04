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
import { GenerationType } from '@prisma/client';
import { GenerationsService } from './generations.service';
import { CurrentUser } from '../common/decorators';
import { TextToImageDto } from './dto/text-to-image.dto';
import { ImageToImageDto } from './dto/image-to-image.dto';
import { TextToVideoDto } from './dto/text-to-video.dto';
import { ImageToVideoDto } from './dto/image-to-video.dto';
import { MotionControlDto } from './dto/motion-control.dto';
import { GenerationFiltersDto } from './dto/generation-filters.dto';
import {
  GenerationResponseDto,
  CreateGenerationResponseDto,
} from './dto/generation-response.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';

@ApiTags('generations')
@ApiBearerAuth()
@Controller('api/v1/generations')
export class GenerationsController {
  constructor(private readonly generationsService: GenerationsService) {}

  @Post('text-to-image')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Gera imagem a partir de texto' })
  @ApiResponse({ status: 201, type: CreateGenerationResponseDto })
  async textToImage(
    @CurrentUser('sub') userId: string,
    @Body() dto: TextToImageDto,
  ): Promise<CreateGenerationResponseDto> {
    return this.generationsService.createGeneration(
      userId,
      GenerationType.TEXT_TO_IMAGE,
      dto,
    );
  }

  @Post('image-to-image')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Gera imagem a partir de imagem + prompt' })
  @ApiResponse({ status: 201, type: CreateGenerationResponseDto })
  async imageToImage(
    @CurrentUser('sub') userId: string,
    @Body() dto: ImageToImageDto,
  ): Promise<CreateGenerationResponseDto> {
    return this.generationsService.createGeneration(
      userId,
      GenerationType.IMAGE_TO_IMAGE,
      dto,
    );
  }

  @Post('text-to-video')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Gera vídeo a partir de texto' })
  @ApiResponse({ status: 201, type: CreateGenerationResponseDto })
  async textToVideo(
    @CurrentUser('sub') userId: string,
    @Body() dto: TextToVideoDto,
  ): Promise<CreateGenerationResponseDto> {
    return this.generationsService.createGeneration(
      userId,
      GenerationType.TEXT_TO_VIDEO,
      dto,
    );
  }

  @Post('image-to-video')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Gera vídeo a partir de imagem' })
  @ApiResponse({ status: 201, type: CreateGenerationResponseDto })
  async imageToVideo(
    @CurrentUser('sub') userId: string,
    @Body() dto: ImageToVideoDto,
  ): Promise<CreateGenerationResponseDto> {
    return this.generationsService.createGeneration(
      userId,
      GenerationType.IMAGE_TO_VIDEO,
      dto,
    );
  }

  @Post('motion-control')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Gera vídeo com motion control' })
  @ApiResponse({ status: 201, type: CreateGenerationResponseDto })
  async motionControl(
    @CurrentUser('sub') userId: string,
    @Body() dto: MotionControlDto,
  ): Promise<CreateGenerationResponseDto> {
    return this.generationsService.createGeneration(
      userId,
      GenerationType.MOTION_CONTROL,
      dto,
    );
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
