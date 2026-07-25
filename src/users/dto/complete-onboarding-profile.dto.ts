import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  E164_REGEX,
  INSTAGRAM_HANDLE_REGEX,
  NICHES,
  OTHER_MAX_LENGTH,
  OTHER_OPTION,
  PROFILE_TYPES,
  SALES_CHANNELS,
} from '../users.constants';

/** Colapsa espaços e corta no limite; string vazia vira undefined. */
function normalizeFreeText(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const cleaned = value.trim().replace(/\s+/g, ' ').slice(0, OTHER_MAX_LENGTH);
  return cleaned.length > 0 ? cleaned : undefined;
}

/** Remove o "@" e espaços do handle do Instagram; string vazia vira undefined. */
function normalizeHandle(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const cleaned = value.trim().replace(/^@+/, '');
  return cleaned.length > 0 ? cleaned : undefined;
}

/** Mantém apenas "+" e dígitos (o front envia formatado em alguns casos). */
function normalizePhone(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const digits = value.replace(/[^\d]/g, '');
  return digits.length > 0 ? `+${digits}` : undefined;
}

export class CompleteOnboardingProfileDto {
  @ApiProperty({ enum: PROFILE_TYPES, example: 'SELLER' })
  @IsIn(PROFILE_TYPES, { message: 'Perfil inválido' })
  profileType: string;

  @ApiPropertyOptional({
    example: 'Dropshipping internacional',
    description: `Obrigatório quando profileType = ${OTHER_OPTION}`,
  })
  @ValidateIf((o: CompleteOnboardingProfileDto) => o.profileType === OTHER_OPTION)
  @Transform(({ value }) => normalizeFreeText(value))
  @IsString({ message: 'Descreva o seu perfil' })
  @Length(2, OTHER_MAX_LENGTH, { message: 'Descreva o seu perfil' })
  profileTypeOther?: string;

  @ApiProperty({ enum: NICHES, example: 'BEAUTY' })
  @IsIn(NICHES, { message: 'Nicho inválido' })
  niche: string;

  @ApiPropertyOptional({
    example: 'Papelaria criativa',
    description: `Obrigatório quando niche = ${OTHER_OPTION}`,
  })
  @ValidateIf((o: CompleteOnboardingProfileDto) => o.niche === OTHER_OPTION)
  @Transform(({ value }) => normalizeFreeText(value))
  @IsString({ message: 'Descreva o seu nicho' })
  @Length(2, OTHER_MAX_LENGTH, { message: 'Descreva o seu nicho' })
  nicheOther?: string;

  @ApiPropertyOptional({
    enum: SALES_CHANNELS,
    isArray: true,
    example: ['TIKTOK_SHOP', 'INSTAGRAM'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(SALES_CHANNELS.length)
  @IsIn(SALES_CHANNELS, { each: true, message: 'Canal inválido' })
  salesChannels?: string[];

  @ApiProperty({
    example: '+5511912345678',
    description: 'Celular/WhatsApp em E.164',
  })
  @Transform(({ value }) => normalizePhone(value))
  @IsString()
  @Matches(E164_REGEX, { message: 'Celular inválido' })
  phone: string;

  @ApiPropertyOptional({ example: 'geraew.ai', description: 'Sem o "@"' })
  @IsOptional()
  @Transform(({ value }) => normalizeHandle(value))
  @IsString()
  @Matches(INSTAGRAM_HANDLE_REGEX, { message: 'Instagram inválido' })
  instagramHandle?: string;
}
