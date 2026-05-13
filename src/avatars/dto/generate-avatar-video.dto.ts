import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsHexColor,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export type AvatarVideoResolution = '720p' | '1080p' | '4k';
export type AvatarVideoAspectRatio = '16:9' | '9:16';
export type AvatarVideoEngine = 'avatar_iv' | 'avatar_v';

export class GenerateAvatarVideoDto {
  @ApiProperty({
    description:
      'Texto que o avatar vai falar (TTS). Use a voz padrão do avatar — voiceId é opcional.',
    example: 'Oi pessoal, aqui é o seu avatar falando sobre nosso novo produto!',
    maxLength: 1500,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1500)
  script: string;

  @ApiPropertyOptional({
    description:
      'Voz HeyGen a usar. Se omitido, usa a voz padrão do avatar (defaultVoiceId). Mutuamente exclusivo com voiceProfileId.',
  })
  @IsOptional()
  @IsString()
  voiceId?: string;

  @ApiPropertyOptional({
    description:
      'ID de uma voz clonada do usuário (VoiceProfile). Quando presente, o backend gera o áudio via Wavespeed/OmniVoice e passa para o HeyGen como audio_url, ignorando voiceId. Lip-sync na foto do avatar.',
  })
  @IsOptional()
  @IsString()
  voiceProfileId?: string;

  @ApiPropertyOptional({
    description:
      'Engine de renderização. Se omitido, usa avatar_iv. avatar_v só funciona em looks que suportam (ver supportedEngines).',
    enum: ['avatar_iv', 'avatar_v'],
  })
  @IsOptional()
  @IsIn(['avatar_iv', 'avatar_v'])
  engine?: AvatarVideoEngine;

  @ApiProperty({
    description: 'Resolução de saída',
    enum: ['720p', '1080p', '4k'],
    default: '1080p',
  })
  @IsIn(['720p', '1080p', '4k'])
  resolution: AvatarVideoResolution;

  @ApiProperty({
    description: 'Proporção de saída',
    enum: ['16:9', '9:16'],
    default: '9:16',
  })
  @IsIn(['16:9', '9:16'])
  aspectRatio: AvatarVideoAspectRatio;

  @ApiPropertyOptional({
    description: 'Cor de fundo em hex (ex: #ffffff). Mutuamente exclusivo com backgroundImageUrl.',
    example: '#ffffff',
  })
  @IsOptional()
  @ValidateIf((o) => !o.backgroundImageUrl)
  @IsHexColor()
  backgroundColor?: string;

  @ApiPropertyOptional({
    description: 'URL pública de imagem de fundo. Mutuamente exclusivo com backgroundColor.',
  })
  @IsOptional()
  @IsString()
  backgroundImageUrl?: string;
}
