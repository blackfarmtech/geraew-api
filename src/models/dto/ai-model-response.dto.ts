import { ApiProperty } from '@nestjs/swagger';
import { AiModelProvider } from '@prisma/client';

export class AiModelResponseDto {
  @ApiProperty()
  slug!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty({ nullable: true })
  description!: string | null;

  @ApiProperty({ enum: ['GERAEW', 'KIE'] })
  provider!: AiModelProvider;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ nullable: true })
  statusMessage!: string | null;

  @ApiProperty()
  sortOrder!: number;
}
