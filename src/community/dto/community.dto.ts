import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SubmitCommunityPostDto {
  @ApiProperty({ description: 'Geração (concluída) que vira o post' })
  @IsString()
  generationId: string;

  @ApiPropertyOptional({
    description: 'Output específico da geração (default: primeiro output)',
  })
  @IsOptional()
  @IsString()
  outputUrl?: string;
}

export class RejectCommunityPostDto {
  @ApiPropertyOptional({ description: 'Motivo exibido ao autor' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
