import {
  IsString,
  IsOptional,
  IsIn,
  IsArray,
  ArrayMaxSize,
  IsBoolean,
  IsNumber,
  Min,
  Max,
  MinLength,
  MaxLength,
  IsEnum,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Resolution } from '@prisma/client';

export class SeedanceReferenceImageDto {
  @ApiProperty({ description: 'Imagem em base64' })
  @IsString()
  base64: string;

  @ApiPropertyOptional({ default: 'image/jpeg' })
  @IsOptional()
  @IsString()
  mime_type?: string;
}

export class SeedanceReferenceVideoDto {
  @ApiProperty({ description: 'Vídeo em base64 (máx 50MB, máx 15s)' })
  @IsString()
  base64: string;

  @ApiPropertyOptional({ default: 'video/mp4' })
  @IsOptional()
  @IsString()
  mime_type?: string;
}

export class SeedanceReferenceAudioDto {
  @ApiProperty({ description: 'Áudio em base64 (máx 15MB, máx 15s, mp3/wav)' })
  @IsString()
  base64: string;

  @ApiPropertyOptional({ default: 'audio/mpeg' })
  @IsOptional()
  @IsString()
  mime_type?: string;
}

export class GenerateSeedanceVideoDto {
  @ApiProperty({
    description: 'Prompt descrevendo o vídeo (3-20000 chars)',
    minLength: 3,
    maxLength: 20000,
  })
  @IsString()
  @MinLength(3)
  @MaxLength(20000)
  prompt: string;

  @ApiProperty({
    description: 'Resolução do vídeo',
    enum: ['RES_480P', 'RES_720P', 'RES_1080P'],
  })
  @IsEnum(Resolution)
  @IsIn(['RES_480P', 'RES_720P', 'RES_1080P'])
  resolution: Resolution;

  @ApiProperty({
    description: 'Duração do vídeo em segundos (Seedance 2: 4-15; Seedance 2.5: 4-30)',
    minimum: 4,
    maximum: 30,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(4)
  @Max(30)
  duration_seconds: number;

  @ApiPropertyOptional({
    description: 'Proporção do vídeo',
    enum: ['1:1', '4:3', '3:4', '16:9', '9:16', '21:9'],
    default: '16:9',
  })
  @IsOptional()
  @IsString()
  @IsIn(['1:1', '4:3', '3:4', '16:9', '9:16', '21:9'])
  aspect_ratio?: string;

  @ApiPropertyOptional({
    description: 'Gerar áudio junto com o vídeo',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  generate_audio?: boolean;

  @ApiPropertyOptional({
    description: 'Imagens de referência (multimodal reference-to-video). Seedance 2: máx 6; Seedance 2.5: máx 30.',
    type: [SeedanceReferenceImageDto],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => SeedanceReferenceImageDto)
  reference_images?: SeedanceReferenceImageDto[];

  @ApiPropertyOptional({
    description: 'Vídeo de referência (multimodal). Quando presente ativa pricing "with video" (mais barato).',
    type: SeedanceReferenceVideoDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => SeedanceReferenceVideoDto)
  reference_video?: SeedanceReferenceVideoDto;

  @ApiPropertyOptional({
    description: 'Áudio de referência (multimodal). Não afeta pricing.',
    type: SeedanceReferenceAudioDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => SeedanceReferenceAudioDto)
  reference_audio?: SeedanceReferenceAudioDto;

  @ApiPropertyOptional({
    description: 'Variante do modelo',
    enum: ['SEEDANCE_2', 'SEEDANCE_2_5'],
    default: 'SEEDANCE_2',
  })
  @IsOptional()
  @IsString()
  @IsIn(['SEEDANCE_2', 'SEEDANCE_2_5'])
  model_variant?: string;
}
