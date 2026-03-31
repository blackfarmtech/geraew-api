import { IsString, IsNotEmpty, IsOptional, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GoogleAuthDto {
  @ApiProperty({
    description: 'Token de autenticação do Google OAuth',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @IsNotEmpty()
  googleToken: string;

  @IsString()
  @IsOptional()
  @MaxLength(50, { message: 'Código de indicação deve ter no máximo 50 caracteres' })
  @Matches(/^[A-Za-z0-9_-]+$/, { message: 'Código de indicação contém caracteres inválidos' })
  referralCode?: string;
}

export class GoogleUserDto {
  @IsString()
  @IsNotEmpty()
  googleId: string;

  @IsString()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @IsString()
  @IsNotEmpty()
  provider: string;
}