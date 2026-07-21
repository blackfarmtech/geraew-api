import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * Corpo do disparo manual do cron de cobrança PIX Automático
 * (`POST /api/v1/admin/crons/pix-billing/run`).
 *
 * Defaults conservadores: sem corpo, cria no máximo 1 cobrança real. Serve para
 * validar contra o ASAAS que a criação passou a ser aceita (fim do erro 400 de
 * `invalid_externalReference`) antes de deixar o cron das 03:00 cobrar todos.
 */
export class RunPixBillingDto {
  /** Restringe a uma assinatura específica (ex.: recuperar um atrasado). */
  @IsOptional()
  @IsString()
  subscriptionId?: string;

  /** Teto de cobranças criadas nesta execução. Default 1 no controller. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  maxCharges?: number;

  /** true = simula sem chamar o ASAAS; false/omitido = cobra de verdade. */
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}
