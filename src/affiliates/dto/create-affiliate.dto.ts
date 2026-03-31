import { IsString, IsNotEmpty, IsOptional, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAffiliateDto {
  @ApiProperty({ example: 'Maria Silva', description: 'Nome do afiliado' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'MARIA30', description: 'Código único do afiliado (será convertido para uppercase)' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({ example: 30, description: 'Percentual de comissão (padrão: 30)' })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  commissionPercent?: number;

  @ApiPropertyOptional({ description: 'ID do usuário associado (opcional)' })
  @IsString()
  @IsOptional()
  userId?: string;
}
