import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ModelsService } from './models.service';
import { AiModelResponseDto } from './dto/ai-model-response.dto';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('models')
@Controller('api/v1/models')
export class ModelsController {
  constructor(private readonly modelsService: ModelsService) {}

  @Public()
  @Get('videos')
  @ApiOperation({ summary: 'Lista modelos de vídeo disponíveis (público)' })
  @ApiResponse({ status: 200, type: [AiModelResponseDto] })
  async listVideos(): Promise<AiModelResponseDto[]> {
    const models = await this.modelsService.listVideoModels();
    return models.map((m) => ({
      slug: m.slug,
      label: m.label,
      description: m.description,
      provider: m.provider,
      isActive: m.isActive,
      statusMessage: m.statusMessage,
      sortOrder: m.sortOrder,
    }));
  }

  @Public()
  @Get('images')
  @ApiOperation({ summary: 'Lista modelos de imagem disponíveis (público)' })
  @ApiResponse({ status: 200, type: [AiModelResponseDto] })
  async listImages(): Promise<AiModelResponseDto[]> {
    const models = await this.modelsService.listImageModels();
    return models.map((m) => ({
      slug: m.slug,
      label: m.label,
      description: m.description,
      provider: m.provider,
      isActive: m.isActive,
      statusMessage: m.statusMessage,
      sortOrder: m.sortOrder,
    }));
  }

  @Public()
  @Get('audio')
  @ApiOperation({ summary: 'Lista modelos de áudio disponíveis (público)' })
  @ApiResponse({ status: 200, type: [AiModelResponseDto] })
  async listAudio(): Promise<AiModelResponseDto[]> {
    const models = await this.modelsService.listAudioModels();
    return models.map((m) => ({
      slug: m.slug,
      label: m.label,
      description: m.description,
      provider: m.provider,
      isActive: m.isActive,
      statusMessage: m.statusMessage,
      sortOrder: m.sortOrder,
    }));
  }
}
