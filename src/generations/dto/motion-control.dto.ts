import { IsString, IsNotEmpty, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { CreateGenerationDto } from './create-generation.dto';

export class MotionControlDto extends CreateGenerationDto {
  @ApiProperty({ description: 'URL da imagem de input (S3 key ou URL pré-assinada)' })
  @IsString()
  @IsNotEmpty({ message: 'URL da imagem de input é obrigatória' })
  inputImageUrl: string;

  @ApiProperty({ description: 'URL do vídeo de referência para motion control' })
  @IsString()
  @IsNotEmpty({ message: 'URL do vídeo de referência é obrigatória' })
  referenceVideoUrl: string;

  @ApiProperty({ description: 'Duração do vídeo em segundos', minimum: 1, maximum: 30 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  durationSeconds: number;
}
