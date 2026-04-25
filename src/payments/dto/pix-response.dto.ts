import { ApiProperty } from '@nestjs/swagger';

export class PixResponseDto {
  @ApiProperty({ description: 'ID do PIX na AbacatePay (pix_char_*)' })
  abacatepayId: string;

  @ApiProperty({ description: 'Valor cobrado em centavos' })
  amountCents: number;

  @ApiProperty({ enum: ['PENDING', 'PAID', 'EXPIRED', 'CANCELLED', 'REFUNDED'] })
  status: string;

  @ApiProperty({ description: 'Código copia-e-cola do PIX' })
  brCode: string;

  @ApiProperty({ description: 'QR Code em data URI (data:image/png;base64,...)' })
  brCodeBase64: string;

  @ApiProperty({ description: 'ISO timestamp de expiração' })
  expiresAt: string;

  @ApiProperty({ description: 'true se o ambiente é sandbox' })
  devMode: boolean;
}
