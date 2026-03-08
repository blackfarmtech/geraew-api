import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Resolution } from '@prisma/client';
import { Transform } from 'class-transformer';

const ASPECT_RATIOS = [
  '1:1', '1:4', '1:8', '2:3', '3:2', '3:4', '4:1',
  '4:3', '4:5', '5:4', '8:1', '9:16', '16:9', '21:9', 'auto',
] as const;

export class CreateGenerationDto {
  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  negativePrompt?: string;

  @ApiProperty({ enum: Resolution })
  @IsEnum(Resolution)
  resolution: Resolution;

  @ApiPropertyOptional({
    description: 'Proporção da imagem gerada',
    enum: ASPECT_RATIOS,
    default: 'auto',
  })
  @IsOptional()
  @IsIn(ASPECT_RATIOS)
  aspectRatio?: string;

  @ApiPropertyOptional({
    description: 'Formato de saída da imagem',
    enum: ['png', 'jpg'],
    default: 'jpg',
  })
  @IsOptional()
  @IsIn(['png', 'jpg'])
  outputFormat?: string;

  @ApiPropertyOptional({
    description: 'Ativar Google Search para contexto real',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  googleSearch?: boolean;

  @ApiPropertyOptional({
    description: 'Modelo de imagem',
    enum: ['gemini-3.1-pro-preview', 'gemini-3.1-flash-image-preview'],
    default: 'gemini-3.1-pro-preview',
  })
  @IsOptional()
  @IsIn(['gemini-3.1-pro-preview', 'gemini-3.1-flash-image-preview'])
  imageModel?: string;

  @ApiPropertyOptional({ description: 'Extra parameters (style, seed, etc.)' })
  @IsOptional()
  parameters?: Record<string, unknown>;
}
