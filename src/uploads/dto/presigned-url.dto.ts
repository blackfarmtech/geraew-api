import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export enum UploadPurpose {
  GENERATION_INPUT = 'generation_input',
  REFERENCE_VIDEO = 'reference_video',
}

const ALLOWED_CONTENT_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'video/mp4',
] as const;

export type AllowedContentType = (typeof ALLOWED_CONTENT_TYPES)[number];

export class PresignedUrlDto {
  @ApiProperty({ example: 'photo.jpg' })
  @IsString()
  @IsNotEmpty()
  filename: string;

  @ApiProperty({
    example: 'image/jpeg',
    enum: ALLOWED_CONTENT_TYPES,
  })
  @IsEnum(ALLOWED_CONTENT_TYPES, {
    message: `contentType deve ser um dos seguintes: ${ALLOWED_CONTENT_TYPES.join(', ')}`,
  })
  contentType: AllowedContentType;

  @ApiProperty({
    example: 'generation_input',
    enum: UploadPurpose,
  })
  @IsEnum(UploadPurpose)
  purpose: UploadPurpose;
}
