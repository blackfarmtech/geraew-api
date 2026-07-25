import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsIn,
  IsEnum,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Resolution } from '@prisma/client';

export class ReferenceImageDto {
  @ApiProperty({ description: 'Imagem em base64' })
  @IsString()
  base64: string;

  @ApiPropertyOptional({
    description: 'MIME type da imagem',
    enum: ['image/jpeg', 'image/png', 'image/webp'],
    default: 'image/jpeg',
  })
  @IsOptional()
  @IsString()
  @IsIn(['image/jpeg', 'image/png', 'image/webp'])
  mime_type?: string;

  @ApiProperty({
    description: 'Tipo de referencia',
    enum: ['asset', 'style'],
  })
  @IsString()
  @IsIn(['asset', 'style'])
  reference_type: 'asset' | 'style';
}

export class GenerateVideoWithReferencesDto {
  @ApiProperty({
    description: 'Prompt de texto para gerar o video',
    example: 'A cinematic aerial shot of a coastal city at sunset',
  })
  @IsString()
  prompt: string;

  @ApiPropertyOptional({
    description: 'Modelo do Vertex AI',
    default: 'veo-3.1-generate-001',
    example: 'veo-3.1-generate-001',
  })
  @IsOptional()
  @IsString()
  @IsIn(['veo-3.1-generate-001', 'veo-3.1-fast-generate-001', 'geraew-fast', 'geraew-quality'])
  model?: string;

  @ApiProperty({ enum: Resolution })
  @IsEnum(Resolution)
  resolution: Resolution;

  @ApiPropertyOptional({
    description:
      'Duracao do video em segundos. Com imagens de referencia o Veo 3.1 so gera 8s — outros valores sao ajustados para 8 automaticamente.',
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
    description:
      'Imagens de referencia (asset: ate 3 imagens do mesmo sujeito, style: 1 imagem de estilo).',
    type: [ReferenceImageDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReferenceImageDto)
  reference_images?: ReferenceImageDto[];

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
