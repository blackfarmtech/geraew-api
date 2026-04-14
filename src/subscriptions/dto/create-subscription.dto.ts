import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSubscriptionDto {
  @ApiProperty({ example: 'starter' })
  @IsString()
  @IsNotEmpty()
  planSlug: string;

  @ApiPropertyOptional({ example: 'BRL', enum: ['BRL', 'USD', 'EUR'] })
  @IsOptional()
  @IsIn(['BRL', 'USD', 'EUR'])
  currency?: string;
}
