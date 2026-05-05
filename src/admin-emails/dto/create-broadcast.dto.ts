import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { RecipientSelectionDto } from './recipient-filter.dto';

export class CreateBroadcastDto extends RecipientSelectionDto {
  @ApiProperty({
    description: 'Assunto do email',
    example: 'Sua capacidade de gerar vídeos triplicou',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(200)
  subject: string;

  @ApiProperty({
    description: 'Corpo do email em Markdown',
    example: '# Olá!\n\nBoa notícia: ...',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(50_000)
  bodyMarkdown: string;
}
