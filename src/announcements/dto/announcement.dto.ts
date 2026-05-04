import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  Matches,
  ValidateIf,
} from 'class-validator';

const VARIANTS = ['feature', 'maintenance', 'promo', 'openai', 'gift', 'mic'] as const;
const ACTION_TYPES = ['open-image-panel', 'open-video-panel', 'open-audio-panel', 'open-weekly-claim', 'href'] as const;

export class CtaActionDto {
  @IsIn(ACTION_TYPES)
  type!: (typeof ACTION_TYPES)[number];

  @ValidateIf((o: CtaActionDto) => o.type === 'href')
  @IsUrl({ require_protocol: true })
  url?: string;
}

export class CreateAnnouncementDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  @Matches(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, {
    message: 'slug deve conter apenas letras minúsculas, números e hífens',
  })
  slug!: string;

  @IsOptional()
  @IsIn(VARIANTS)
  variant?: (typeof VARIANTS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(40)
  badge?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(160)
  title!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(600)
  description!: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  ctaLabel?: string;

  @IsOptional()
  ctaAction?: CtaActionDto;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateAnnouncementDto {
  // slug is intentionally NOT updatable — preserves localStorage seen-state stability

  @IsOptional()
  @IsIn(VARIANTS)
  variant?: (typeof VARIANTS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(40)
  badge?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(600)
  description?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  imageUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  ctaLabel?: string | null;

  @IsOptional()
  ctaAction?: CtaActionDto | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
