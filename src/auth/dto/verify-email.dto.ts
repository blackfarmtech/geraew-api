import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyEmailDto {
  @ApiProperty({
    example: 'a1b2c3d4e5f6...',
    description: 'Token de verificação de email recebido por email',
  })
  @IsString()
  @IsNotEmpty({ message: 'Token é obrigatório' })
  token: string;
}
