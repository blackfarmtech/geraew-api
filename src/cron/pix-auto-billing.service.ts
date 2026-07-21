import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AsaasSubscriptionsService } from '../payments/asaas-subscriptions.service';
import { CronLoggerService } from './cron-logger.service';
import {
  addBusinessDays,
  businessDaysBetween,
  nextBusinessDay,
  toBrasiliaDateString,
  todayInBrasilia,
} from '../common/utils/business-days.util';
import { encodeAsaasReference } from '../payments/external-reference.util';

const SCHEDULE = '0 6 * * *'; // 06:00 UTC = 03:00 BRT, todo dia

/**
 * Antecedência alvo, em DIAS ÚTEIS, entre a criação da cobrança e o
 * vencimento. O BACEN aceita de 2 a 10; miramos 7 pra ter margem de sobra
 * para fim de semana, feriado e uma eventual falha de API.
 */
const TARGET_BUSINESS_DAYS = 7;
/** Piso operacional — deliberadamente acima do mínimo regulatório de 2. */
const MIN_BUSINESS_DAYS = 3;
/** Teto regulatório: criar antes disso é recusado pelo ASAAS. */
const MAX_BUSINESS_DAYS = 10;
/** Varredura em dias corridos à frente. Precisa cobrir MAX + fins de semana. */
const LOOKAHEAD_DAYS = 21;
/**
 * Quanto tempo para trás ainda tentamos recuperar um ciclo não cobrado.
 * Evita ressuscitar assinaturas antigas e abandonadas.
 */
const MAX_OVERDUE_DAYS = 45;

type DueDateResolution =
  | { kind: 'ok'; dueDate: string }
  | { kind: 'too_early' }
  | { kind: 'too_overdue' };

type SkipReason =
  | 'ja_cobrado_no_ciclo'
  | 'muito_cedo'
  | 'vencido_demais'
  | 'sem_authorization_id'
  | 'sem_customer_id'
  | 'autorizacao_inativa';

interface BillingSummary extends Record<string, unknown> {
  candidatos: number;
  criadas: number;
  simuladas: number;
  falhas: number;
  puladas: Record<string, number>;
  erros: Array<{ subscriptionId: string; email: string; motivo: string }>;
  dessincronizadas: Array<{
    subscriptionId: string;
    email: string;
    statusAsaas: string;
  }>;
  modo: 'live' | 'dry_run';
}

/**
 * Cron diário que cria as cobranças recorrentes das subscriptions PIX
 * Automático.
 *
 * Regra do BACEN: a instrução de cobrança precisa ser criada entre 2 e 10
 * DIAS ÚTEIS antes do vencimento, e o débito só ocorre em dia útil. A versão
 * anterior deste cron usava uma janela de 2 a 4 dias CORRIDOS e mandava o
 * `currentPeriodEnd` cru como vencimento — o que rendia de 0 a 2 dias úteis de
 * antecedência e vencimentos caindo em sábado/domingo. Nenhuma cobrança
 * recorrente chegou a ser aceita pelo ASAAS por causa disso.
 *
 * Idempotência: uma cobrança por ciclo, verificada contra `currentPeriodStart`
 * (a regra antiga, "algum Payment nos últimos 5 dias", cobraria em duplicidade
 * agora que a janela é maior que isso).
 */
@Injectable()
export class PixAutoBillingService {
  private readonly logger = new Logger(PixAutoBillingService.name);
  private readonly dryRun: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly asaasSubscriptionsService: AsaasSubscriptionsService,
    private readonly cronLogger: CronLoggerService,
    private readonly configService: ConfigService,
  ) {
    this.dryRun =
      this.configService.get<string>('PIX_AUTO_BILLING_MODE') === 'dry_run';
  }

  @Cron(SCHEDULE)
  async handlePixAutoBilling(): Promise<BillingSummary> {
    return this.cronLogger.wrap(
      {
        cronName: 'PixAutoBillingService.handlePixAutoBilling',
        schedule: SCHEDULE,
      },
      async () => this.run(),
    );
  }

  /** Exposto para o disparo manual do admin e para os testes. */
  async run(now: Date = new Date()): Promise<BillingSummary> {
    const today = todayInBrasilia(now);
    const lookaheadEnd = new Date(now.getTime() + LOOKAHEAD_DAYS * 86400000);
    const overdueFloor = new Date(now.getTime() - MAX_OVERDUE_DAYS * 86400000);

    const candidates = await this.prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        paymentMethod: 'pix_auto_asaas',
        asaasAuthorizationStatus: 'ACTIVE',
        currentPeriodEnd: { gte: overdueFloor, lte: lookaheadEnd },
      },
      include: { plan: true, user: true },
    });

    const summary: BillingSummary = {
      candidatos: candidates.length,
      criadas: 0,
      simuladas: 0,
      falhas: 0,
      puladas: {},
      erros: [],
      dessincronizadas: [],
      modo: this.dryRun ? 'dry_run' : 'live',
    };

    const skip = (reason: SkipReason) => {
      summary.puladas[reason] = (summary.puladas[reason] ?? 0) + 1;
    };

    this.logger.log(
      `PIX Auto billing (${summary.modo}) — ${candidates.length} candidatos, hoje=${today}`,
    );

    for (const sub of candidates) {
      try {
        // Uma cobrança por ciclo. Se a do ciclo atual já existe, nada a fazer.
        const alreadyCharged = await this.prisma.payment.findFirst({
          where: {
            subscriptionId: sub.id,
            type: 'SUBSCRIPTION',
            provider: 'asaas',
            status: { in: ['PENDING', 'COMPLETED'] },
            createdAt: { gte: sub.currentPeriodStart },
          },
          select: { id: true },
        });
        if (alreadyCharged) {
          skip('ja_cobrado_no_ciclo');
          continue;
        }

        if (!sub.asaasAuthorizationId) {
          this.logger.warn(`Subscription ${sub.id} sem authorizationId — skip`);
          skip('sem_authorization_id');
          continue;
        }
        if (!sub.user.asaasCustomerId) {
          this.logger.warn(`Subscription ${sub.id} sem customerId — skip`);
          skip('sem_customer_id');
          continue;
        }

        const resolution = this.resolveDueDate(sub.currentPeriodEnd, today);
        if (resolution.kind !== 'ok') {
          skip(
            resolution.kind === 'too_early' ? 'muito_cedo' : 'vencido_demais',
          );
          continue;
        }
        const dueDate = resolution.dueDate;

        // Revalida no ASAAS antes de cobrar. Sem isso dependemos só do webhook
        // de cancelamento — que ficou meses desabilitado no painel e deixou o
        // banco achando que autorizações revogadas seguiam ativas.
        const auth = await this.asaasSubscriptionsService.getAuthorization(
          sub.asaasAuthorizationId,
        );
        if (auth.status !== 'ACTIVE') {
          await this.syncInactiveAuthorization(sub.id, auth.status);
          summary.dessincronizadas.push({
            subscriptionId: sub.id,
            email: sub.user.email,
            statusAsaas: auth.status,
          });
          skip('autorizacao_inativa');
          continue;
        }

        if (this.dryRun) {
          summary.simuladas++;
          this.logger.log(
            `[DRY RUN] Criaria cobrança de R$ ${(sub.plan.priceCents / 100).toFixed(2)} ` +
              `para ${sub.user.email} (sub ${sub.id}), vencimento ${dueDate}`,
          );
          continue;
        }

        const charge =
          await this.asaasSubscriptionsService.createRecurringCharge({
            customerId: sub.user.asaasCustomerId,
            authorizationId: sub.asaasAuthorizationId,
            valueCents: sub.plan.priceCents,
            dueDate,
            description: `Renovação ${sub.plan.name} (Geraew)`,
            externalReference: encodeAsaasReference({
              kind: 'subscription',
              subscriptionId: sub.id,
            }),
          });

        await this.prisma.payment.create({
          data: {
            userId: sub.userId,
            type: 'SUBSCRIPTION',
            amountCents: sub.plan.priceCents,
            currency: 'BRL',
            status: 'PENDING',
            provider: 'asaas',
            externalPaymentId: charge.id,
            subscriptionId: sub.id,
          },
        });

        summary.criadas++;
        this.logger.log(
          `Cobrança ${charge.id} criada para subscription ${sub.id} ` +
            `(${sub.user.email}), vencimento ${dueDate}`,
        );
      } catch (error) {
        const motivo = error instanceof Error ? error.message : String(error);
        summary.falhas++;
        // Persistido no metadata do cron_executions: o modo antigo mandava isso
        // só pro logger da aplicação e a falha passou dias despercebida.
        summary.erros.push({
          subscriptionId: sub.id,
          email: sub.user.email,
          motivo: motivo.slice(0, 300),
        });
        this.logger.error(
          `Failed to create charge for subscription ${sub.id}: ${motivo}`,
        );
      }
    }

    this.logger.log(
      `PIX Auto billing done — criadas=${summary.criadas} simuladas=${summary.simuladas} ` +
        `falhas=${summary.falhas} puladas=${JSON.stringify(summary.puladas)}`,
    );

    return summary;
  }

  /**
   * Vencimento a enviar para o ASAAS, sempre em dia útil e sempre dentro da
   * janela regulatória.
   *
   * - `too_early`: ainda falta muito; o cron volta amanhã.
   * - `too_overdue`: ciclo vencido além do limite de recuperação.
   * - Se a janela ideal já passou (o vencimento está perto ou no passado),
   *   remarca para o próximo horizonte válido — é assim que um ciclo que
   *   deveria ter sido cobrado e não foi acaba sendo recuperado.
   */
  private resolveDueDate(periodEnd: Date, today: string): DueDateResolution {
    const naturalDue = nextBusinessDay(toBrasiliaDateString(periodEnd));
    const advance = businessDaysBetween(today, naturalDue);

    if (advance > MAX_BUSINESS_DAYS) return { kind: 'too_early' };
    if (advance >= MIN_BUSINESS_DAYS)
      return { kind: 'ok', dueDate: naturalDue };

    // Perdemos a janela ideal (ou o ciclo já venceu): cobra o quanto antes for
    // legalmente possível, em vez de pular o ciclo e perder a receita.
    const overdueBusinessDays = businessDaysBetween(naturalDue, today);
    if (overdueBusinessDays > MAX_OVERDUE_DAYS) return { kind: 'too_overdue' };

    const recoveryDue = addBusinessDays(today, TARGET_BUSINESS_DAYS);
    this.logger.warn(
      `Janela ideal perdida (vencimento natural ${naturalDue}, hoje ${today}) — ` +
        `remarcando cobrança para ${recoveryDue}`,
    );
    return { kind: 'ok', dueDate: recoveryDue };
  }

  /**
   * Autorização deixou de estar ativa no ASAAS. Sincroniza o status e agenda o
   * fim do acesso para o término do período já pago — o usuário pagou pelo
   * ciclo corrente, então não cortamos no meio.
   */
  private async syncInactiveAuthorization(
    subscriptionId: string,
    status: string,
  ): Promise<void> {
    await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        asaasAuthorizationStatus: status,
        cancelAtPeriodEnd: true,
      },
    });
    this.logger.warn(
      `Subscription ${subscriptionId}: autorização está ${status} no ASAAS — ` +
        `marcada para encerrar no fim do período pago`,
    );
  }
}
