import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PlanAnnualPriceDto {
  @ApiProperty({ description: 'Valor cobrado por ano, em centavos' })
  priceCents: number;
  @ApiProperty({ description: 'priceCents / 12, para exibir "R$ X/mês"' })
  monthlyEquivalentCents: number;
  @ApiProperty({ example: 'BRL' }) currency: string;
  @ApiProperty({ example: 20, description: 'Desconto real vs 12× o mensal' })
  discountPercent: number;
}

export class PlanResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() slug: string;
  @ApiProperty() name: string;
  @ApiPropertyOptional() description: string | null;
  @ApiProperty({ description: 'Preço em centavos na moeda resolvida' })
  priceCents: number;
  @ApiProperty({ example: 'BRL' }) currency: string;
  @ApiProperty() creditsPerMonth: number;
  @ApiProperty() maxConcurrentGenerations: number;
  @ApiProperty() hasWatermark: boolean;
  @ApiPropertyOptional() galleryRetentionDays: number | null;
  @ApiProperty() hasApiAccess: boolean;
  @ApiPropertyOptional({
    type: PlanAnnualPriceDto,
    nullable: true,
    description: 'Opção de cobrança anual. null = plano sem anual.',
  })
  annual: PlanAnnualPriceDto | null;
}

export class CreditPackageResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() credits: number;
  @ApiProperty() priceCents: number;
  @ApiProperty({ example: 'BRL' }) currency: string;
}
