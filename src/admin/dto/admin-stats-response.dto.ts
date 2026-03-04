import { ApiProperty } from '@nestjs/swagger';

export class GenerationsByStatusDto {
  @ApiProperty()
  pending: number;

  @ApiProperty()
  processing: number;

  @ApiProperty()
  completed: number;

  @ApiProperty()
  failed: number;
}

export class AdminStatsResponseDto {
  @ApiProperty()
  totalUsers: number;

  @ApiProperty()
  activeSubscriptions: number;

  @ApiProperty({ description: 'Total revenue in cents (BRL)' })
  totalRevenueCents: number;

  @ApiProperty()
  totalGenerations: number;

  @ApiProperty()
  generationsByStatus: GenerationsByStatusDto;
}
