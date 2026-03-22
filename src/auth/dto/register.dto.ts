import { IsEmail, IsString, MinLength, MaxLength, Matches, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'Email do usuário',
  })
  @IsEmail({}, { message: 'Email inválido' })
  @IsNotEmpty({ message: 'Email é obrigatório' })
  email: string;

  @ApiProperty({
    example: 'John Doe',
    description: 'Nome completo do usuário',
  })
  @IsString()
  @IsNotEmpty({ message: 'Nome é obrigatório' })
  @MinLength(2, { message: 'Nome deve ter no mínimo 2 caracteres' })
  @MaxLength(100, { message: 'Nome deve ter no máximo 100 caracteres' })
  name: string;

  @ApiProperty({
    example: 'SecurePassword123!',
    description: 'Senha do usuário',
  })
  @IsString()
  @IsNotEmpty({ message: 'Senha é obrigatória' })
  @MinLength(8, { message: 'Senha deve ter no mínimo 8 caracteres' })
  @MaxLength(100, { message: 'Senha deve ter no máximo 100 caracteres' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d\W_]{8,}$/,
    {
      message: 'Senha deve conter pelo menos uma letra maiúscula, uma minúscula e um número',
    },
  )
  password: string;

  @ApiProperty({
    example: '5511999998888',
    description: 'Número de telefone com código do país',
  })
  @IsString()
  @IsNotEmpty({ message: 'Telefone é obrigatório' })
  @Matches(/^\+?\d{10,15}$/, {
    message: 'Telefone inválido. Use formato: 5511999998888',
  })
  phone: string;

  @ApiProperty({
    example: 'eyJhbGciOiJSUzI1NiIs...',
    description: 'Firebase ID Token obtido após verificação do SMS',
  })
  @IsString()
  @IsNotEmpty({ message: 'Token de verificação é obrigatório' })
  firebaseToken: string;
}
