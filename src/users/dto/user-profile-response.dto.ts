import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NICHES, PROFILE_TYPES, SALES_CHANNELS } from '../users.constants';

export class PlanInfoDto {
  @ApiProperty() slug: string;
  @ApiProperty() name: string;
  @ApiProperty() priceCents: number;
  @ApiProperty() maxConcurrentGenerations: number;
  @ApiProperty() hasWatermark: boolean;
  @ApiProperty() hasApiAccess: boolean;
}

export class CreditInfoDto {
  @ApiProperty() planCreditsRemaining: number;
  @ApiProperty() bonusCreditsRemaining: number;
  @ApiProperty() planCreditsUsed: number;
  @ApiPropertyOptional() periodStart: Date | null;
  @ApiPropertyOptional() periodEnd: Date | null;
}

export class SubscriptionInfoDto {
  @ApiProperty() status: string;
  @ApiProperty() currentPeriodStart: Date;
  @ApiProperty() currentPeriodEnd: Date;
  @ApiProperty() cancelAtPeriodEnd: boolean;
}

export class UserProfileResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty() name: string;
  @ApiPropertyOptional() avatarUrl: string | null;
  @ApiProperty() role: string;
  @ApiProperty() emailVerified: boolean;
  @ApiProperty() createdAt: Date;
  @ApiProperty() hasCompletedOnboarding: boolean;
  @ApiPropertyOptional() country: string | null;
  @ApiProperty() locale: string;
  @ApiProperty() currency: string;
  @ApiPropertyOptional() timezone: string | null;
  @ApiPropertyOptional() plan: PlanInfoDto | null;
  @ApiPropertyOptional() credits: CreditInfoDto | null;
  @ApiPropertyOptional() subscription: SubscriptionInfoDto | null;
  @ApiProperty({
    description:
      'true quando o usuário já respondeu o cadastro de perfil (nicho + contato)',
  })
  profileCompleted: boolean;
  @ApiPropertyOptional({ enum: PROFILE_TYPES }) profileType: string | null;
  @ApiPropertyOptional({ description: 'Texto livre quando profileType = OTHER' })
  profileTypeOther: string | null;
  @ApiPropertyOptional({ enum: NICHES }) niche: string | null;
  @ApiPropertyOptional({ description: 'Texto livre quando niche = OTHER' })
  nicheOther: string | null;
  @ApiProperty({ enum: SALES_CHANNELS, isArray: true })
  salesChannels: string[];
  @ApiPropertyOptional({ description: 'Celular/WhatsApp em E.164' })
  phone: string | null;
  @ApiPropertyOptional({ description: 'Handle do Instagram, sem "@"' })
  instagramHandle: string | null;
  @ApiProperty() feedbackSubmitted: boolean;
  @ApiProperty({ description: 'true se o usuário já cadastrou CPF/CNPJ em alguma compra PIX anterior' })
  hasTaxIdOnFile: boolean;
  @ApiPropertyOptional({
    description:
      'CPF/CNPJ salvo do usuário com mascara aplicada (ex: •••.•••.•••-12). Null se não tiver.',
  })
  taxIdMasked: string | null;
}
