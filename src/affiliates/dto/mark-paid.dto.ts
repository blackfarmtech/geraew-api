import { IsArray, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MarkEarningsPaidDto {
  @ApiProperty({ description: 'IDs dos earnings para marcar como pagos' })
  @IsArray()
  @IsString({ each: true })
  earningIds: string[];
}
