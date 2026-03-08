import { IsString, IsNotEmpty, IsInt, IsBoolean, IsOptional, Min, Max, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateGenerationDto } from './create-generation.dto';

export class ImageToVideoDto extends CreateGenerationDto {
  @ApiPropertyOptional({ description: 'Prompt para guiar a geração do vídeo', maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000, { message: 'Prompt excede o limite de 5000 caracteres' })
  prompt?: string;

  @ApiProperty({ description: 'URL da imagem de input (S3 key ou URL pré-assinada)' })
  @IsString()
  @IsNotEmpty({ message: 'URL da imagem de input é obrigatória' })
  inputImageUrl: string;

  @ApiProperty({ description: 'Duração do vídeo em segundos', minimum: 1, maximum: 30 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  durationSeconds: number;

  @ApiPropertyOptional({ description: 'Se o vídeo deve ter áudio', default: false })
  @IsOptional()
  @IsBoolean()
  hasAudio?: boolean;

  @ApiPropertyOptional({ description: 'URL do último frame (S3 key ou URL pré-assinada)' })
  @IsOptional()
  @IsString()
  lastFrameUrl?: string;
}
