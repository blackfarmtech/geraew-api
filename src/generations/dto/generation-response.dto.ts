import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GenerationType, GenerationStatus, Resolution } from '@prisma/client';

export class GenerationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: GenerationType })
  type: GenerationType;

  @ApiProperty({ enum: GenerationStatus })
  status: GenerationStatus;

  @ApiPropertyOptional()
  prompt?: string;

  @ApiPropertyOptional()
  negativePrompt?: string;

  @ApiPropertyOptional()
  inputImageUrl?: string;

  @ApiPropertyOptional()
  referenceVideoUrl?: string;

  @ApiProperty({ enum: Resolution })
  resolution: Resolution;

  @ApiPropertyOptional()
  durationSeconds?: number;

  @ApiProperty()
  hasAudio: boolean;

  @ApiPropertyOptional()
  modelUsed?: string;

  @ApiPropertyOptional()
  parameters?: Record<string, unknown>;

  @ApiPropertyOptional()
  outputUrl?: string;

  @ApiPropertyOptional()
  thumbnailUrl?: string;

  @ApiProperty()
  hasWatermark: boolean;

  @ApiProperty()
  creditsConsumed: number;

  @ApiPropertyOptional()
  processingTimeMs?: number;

  @ApiPropertyOptional()
  errorMessage?: string;

  @ApiPropertyOptional()
  errorCode?: string;

  @ApiProperty()
  isFavorited: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional()
  completedAt?: Date;
}

export class CreateGenerationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: GenerationStatus })
  status: GenerationStatus;

  @ApiProperty()
  creditsConsumed: number;
}
