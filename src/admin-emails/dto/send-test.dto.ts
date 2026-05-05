import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendTestDto {
  @ApiProperty({ description: 'Assunto do email' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(200)
  subject: string;

  @ApiProperty({ description: 'Corpo do email em Markdown' })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(50_000)
  bodyMarkdown: string;
}
