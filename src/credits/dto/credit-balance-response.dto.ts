import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreditBalanceResponseDto {
  @ApiProperty()
  planCreditsRemaining: number;

  @ApiProperty()
  bonusCreditsRemaining: number;

  @ApiProperty()
  totalCreditsAvailable: number;

  @ApiProperty()
  planCreditsUsed: number;

  @ApiPropertyOptional()
  periodStart: Date | null;

  @ApiPropertyOptional()
  periodEnd: Date | null;
}
