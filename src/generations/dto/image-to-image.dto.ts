import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CreateGenerationDto } from './create-generation.dto';

export class ImageToImageDto extends CreateGenerationDto {
  @ApiProperty({ description: 'Prompt para transformação da imagem', maxLength: 20000 })
  @IsString()
  @IsNotEmpty({ message: 'Prompt é obrigatório para image-to-image' })
  @MaxLength(20000, { message: 'Prompt excede o limite de 20000 caracteres' })
  prompt: string;

  @ApiProperty({ description: 'URL da imagem de input (S3 key ou URL pré-assinada)' })
  @IsString()
  @IsNotEmpty({ message: 'URL da imagem de input é obrigatória' })
  inputImageUrl: string;
}
