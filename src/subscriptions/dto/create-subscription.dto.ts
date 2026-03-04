import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSubscriptionDto {
  @ApiProperty({
    description: 'Slug do plano desejado',
    example: 'starter',
  })
  @IsString()
  @IsNotEmpty()
  planSlug: string;
}
