import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PurchaseCreditsDto {
  @ApiProperty({ description: 'ID of the credit package to purchase' })
  @IsString()
  @IsNotEmpty()
  packageId: string;
}
