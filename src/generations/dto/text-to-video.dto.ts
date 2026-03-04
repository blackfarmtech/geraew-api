import { IsString, IsNotEmpty, IsInt, IsBoolean, IsOptional, Min, Max, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateGenerationDto } from './create-generation.dto';

export class TextToVideoDto extends CreateGenerationDto {
  @ApiProperty({ description: 'Prompt para geração de vídeo', maxLength: 5000 })
  @IsString()
  @IsNotEmpty({ message: 'Prompt é obrigatório para text-to-video' })
  @MaxLength(5000, { message: 'Prompt excede o limite de 5000 caracteres' })
  prompt: string;

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
}
