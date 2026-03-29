import { IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdjustFreeGenerationsDto {
  @ApiProperty({
    description: 'Number of free Veo generations to set (absolute value)',
    example: 2,
  })
  @IsInt()
  @Min(0)
  amount: number;
}
