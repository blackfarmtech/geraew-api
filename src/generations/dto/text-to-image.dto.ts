import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CreateGenerationDto } from './create-generation.dto';

export class TextToImageDto extends CreateGenerationDto {
  @ApiProperty({ description: 'Prompt para geração de imagem', maxLength: 20000 })
  @IsString()
  @IsNotEmpty({ message: 'Prompt é obrigatório para text-to-image' })
  @MaxLength(20000, { message: 'Prompt excede o limite de 20000 caracteres' })
  prompt: string;
}
