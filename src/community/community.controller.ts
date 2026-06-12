import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators';
import { CommunityService } from './community.service';
import { SubmitCommunityPostDto } from './dto/community.dto';

@ApiTags('community')
@ApiBearerAuth()
@Controller('api/v1/community')
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  @Get('posts')
  @ApiOperation({ summary: 'Feed da comunidade (posts aprovados)' })
  @ApiResponse({ status: 200, description: 'Feed retornado com sucesso' })
  async feed(
    @CurrentUser('sub') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.communityService.feed(
      userId,
      Math.max(1, parseInt(page ?? '1', 10) || 1),
      Math.min(60, Math.max(1, parseInt(limit ?? '30', 10) || 30)),
    );
  }

  @Get('posts/mine')
  @ApiOperation({ summary: 'Posts do usuario (com status de moderacao)' })
  @ApiResponse({ status: 200, description: 'Posts retornados com sucesso' })
  async mine(@CurrentUser('sub') userId: string) {
    return this.communityService.mine(userId);
  }

  @Post('posts')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Enviar uma geracao para aprovacao na comunidade' })
  @ApiResponse({ status: 201, description: 'Post enviado para analise' })
  async submit(
    @CurrentUser('sub') userId: string,
    @Body() dto: SubmitCommunityPostDto,
  ) {
    return this.communityService.submit(userId, dto);
  }

  @Post('posts/:id/like')
  @ApiOperation({ summary: 'Curtir um post' })
  @ApiResponse({ status: 201, description: 'Post curtido' })
  async like(@CurrentUser('sub') userId: string, @Param('id') postId: string) {
    return this.communityService.like(userId, postId);
  }

  @Delete('posts/:id/like')
  @ApiOperation({ summary: 'Remover curtida de um post' })
  @ApiResponse({ status: 200, description: 'Curtida removida' })
  async unlike(
    @CurrentUser('sub') userId: string,
    @Param('id') postId: string,
  ) {
    return this.communityService.unlike(userId, postId);
  }
}
