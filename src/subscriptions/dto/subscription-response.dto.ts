import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubscriptionPlanDto {
  @ApiProperty() id: string;
  @ApiProperty() slug: string;
  @ApiProperty() name: string;
  @ApiProperty() priceCents: number;
  @ApiProperty() creditsPerMonth: number;
  @ApiProperty() maxConcurrentGenerations: number;
  @ApiProperty() hasWatermark: boolean;
  @ApiPropertyOptional() galleryRetentionDays: number | null;
  @ApiProperty() hasApiAccess: boolean;
}

export class ScheduledPlanDto {
  @ApiProperty() id: string;
  @ApiProperty() slug: string;
  @ApiProperty() name: string;
  @ApiProperty() priceCents: number;
  @ApiProperty() creditsPerMonth: number;
}

export class SubscriptionResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() status: string;
  @ApiProperty() currentPeriodStart: Date;
  @ApiProperty() currentPeriodEnd: Date;
  @ApiProperty() cancelAtPeriodEnd: boolean;
  @ApiPropertyOptional() paymentProvider: string | null;
  @ApiProperty() paymentRetryCount: number;
  @ApiProperty() createdAt: Date;
  @ApiProperty() plan: SubscriptionPlanDto;
  @ApiPropertyOptional() scheduledPlan?: ScheduledPlanDto;
}
