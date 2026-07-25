import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Recorte do dashboard de público. A coorte é por data de cadastro do usuário;
 * omitir `days` significa "todo o histórico".
 */
export class AudienceRangeDto {
  @ApiPropertyOptional({
    minimum: 1,
    maximum: 3650,
    description: 'Coorte dos últimos N dias por data de cadastro. Omitido = tudo.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  days?: number;
}
