import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAffiliateDto {
  @ApiPropertyOptional({ example: 'Maria Silva', description: 'Nome do afiliado' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 30, description: 'Percentual de comissão' })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  commissionPercent?: number;

  @ApiPropertyOptional({ description: 'ID do usuário associado (null para remover)' })
  @IsString()
  @IsOptional()
  userId?: string | null;
}
