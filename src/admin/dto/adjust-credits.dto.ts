import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const CREDIT_SOURCES = ['bonus', 'plan'] as const;
export type CreditSource = (typeof CREDIT_SOURCES)[number];

export class AdjustCreditsDto {
  @ApiProperty({
    description: 'Amount to adjust (positive to add, negative to remove)',
    example: 100,
  })
  @IsInt()
  @IsNotEmpty()
  amount: number;

  @ApiProperty({
    description: 'Reason for the adjustment',
    example: 'Compensação por erro na geração',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description: string;

  @ApiPropertyOptional({
    enum: CREDIT_SOURCES,
    default: 'bonus',
    description:
      'Saldo ajustado: bônus (não expira, padrão) ou franquia do plano (zera na renovação)',
  })
  @IsOptional()
  @IsIn(CREDIT_SOURCES)
  source?: CreditSource;
}

export class ZeroCreditsDto {
  @ApiProperty({
    description: 'Motivo, gravado no histórico de créditos do usuário',
    example: 'Plano obtido por falha no cupom de upgrade',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description: string;
}
