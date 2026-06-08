import { IsString, IsNotEmpty, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePixBoostDto {
  @ApiProperty({ description: 'ID do pacote de créditos (CreditPackage.id)' })
  @IsString()
  @IsNotEmpty()
  packageId: string;

  @ApiProperty({
    description: 'CPF (11 dígitos) ou CNPJ (14 dígitos) do pagador, sem máscara. Obrigatório pelo ASAAS.',
    example: '12345678909',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{11}$|^\d{14}$/, {
    message: 'taxId deve conter 11 (CPF) ou 14 (CNPJ) dígitos numéricos',
  })
  taxId: string;
}
