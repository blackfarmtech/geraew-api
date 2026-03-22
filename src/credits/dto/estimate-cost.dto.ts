import { IsEnum, IsOptional, IsInt, IsBoolean, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GenerationType, Resolution } from '@prisma/client';

export class EstimateCostDto {
  @ApiProperty({ enum: GenerationType })
  @IsEnum(GenerationType)
  type: GenerationType;

  @ApiProperty({ enum: Resolution })
  @IsEnum(Resolution)
  resolution: Resolution;

  @ApiPropertyOptional({ description: 'Duration in seconds (for video types)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationSeconds?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  hasAudio?: boolean;

  @ApiPropertyOptional({ description: 'Number of samples to generate', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sampleCount?: number;

  @ApiPropertyOptional({ description: 'Model variant (e.g. NB2, NBP, VEO_FAST, VEO_MAX)' })
  @IsOptional()
  @IsString()
  modelVariant?: string;
}

export class EstimateCostResponseDto {
  @ApiProperty()
  creditsRequired: number;

  @ApiProperty()
  hasSufficientBalance: boolean;
}
