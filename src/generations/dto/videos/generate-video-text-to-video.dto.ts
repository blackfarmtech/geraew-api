import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsIn,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Resolution } from '@prisma/client';

export class GenerateVideoTextToVideoDto {
  @ApiProperty({
    description: 'Prompt de texto para gerar o video',
    example: 'A cinematic aerial shot of a coastal city at sunset',
  })
  @IsString()
  prompt: string;

  @ApiProperty({
    description:
      'Modelo Veo 3.1 (roda no KIE). veo3_fast = Veo 3.1 Fast, veo3 = Veo 3.1 Quality. ' +
      'Os nomes antigos (geraew-*, veo-3.1-*) continuam aceitos e são convertidos.',
    default: 'veo3',
    example: 'veo3_fast',
  })
  @IsString()
  @IsIn(['veo3', 'veo3_fast', 'veo-3.1-generate-001', 'veo-3.1-fast-generate-001', 'geraew-fast', 'geraew-quality'])
  model: string;

  @ApiProperty({ enum: Resolution })
  @IsEnum(Resolution)
  resolution: Resolution;

  @ApiPropertyOptional({
    description: 'Duracao do video em segundos',
    enum: [4, 6, 8],
    default: 8,
    example: 8,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsIn([4, 6, 8])
  duration_seconds?: number;

  @ApiPropertyOptional({
    description: 'Proporcao do video',
    enum: ['16:9', '9:16'],
    default: '16:9',
  })
  @IsOptional()
  @IsString()
  @IsIn(['16:9', '9:16'])
  aspect_ratio?: string;

  @ApiPropertyOptional({
    description: 'Gerar audio junto com o video',
    default: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  generate_audio?: boolean;

  @ApiPropertyOptional({
    description: 'Quantidade de amostras a gerar',
    default: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sample_count?: number;

  @ApiPropertyOptional({
    description: 'Prompt negativo (o que evitar)',
    example: 'blurry, low quality',
  })
  @IsOptional()
  @IsString()
  negative_prompt?: string;

  @ApiPropertyOptional({
    description: 'Variante do modelo (VEO_FAST, VEO_MAX)',
  })
  @IsOptional()
  @IsString()
  model_variant?: string;

  @ApiPropertyOptional({
    description:
      'Se true, processa a geração no modo ilimitado (sem consumir créditos). Requer plano com modo ilimitado habilitado para o modelo/resolução.',
    default: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  unlimited?: boolean;
}
