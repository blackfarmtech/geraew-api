import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PendingGrantsService } from './pending-grants.service';

/**
 * Webhooks de plataformas de curso (Hubla, Cartpanda, Greenn, Perfectpay, Hotmart)
 * foram REMOVIDOS em 2026-06-30 por risco de segurança (autenticação falhava aberta
 * / inexistente — qualquer um mintava free-generation bundles por e-mail).
 * Mantido apenas o PendingGrantsService para o resgate de grants já existentes no cadastro.
 */
@Module({
  imports: [PrismaModule],
  providers: [PendingGrantsService],
  exports: [PendingGrantsService],
})
export class PendingGrantsModule {}
