import { IsString, IsNotEmpty, IsOptional, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBoostPixDto {
  @ApiProperty({ description: 'ID do pacote de créditos (CreditPackage.id)' })
  @IsString()
  @IsNotEmpty()
  packageId: string;

  @ApiPropertyOptional({
    description: 'CPF/CNPJ do pagador (somente dígitos), usado pela AbacatePay como referência',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{11}$|^\d{14}$/, { message: 'taxId deve conter 11 (CPF) ou 14 (CNPJ) dígitos' })
  taxId?: string;
}
