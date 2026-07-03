import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { AvatarStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AvatarsService } from '../avatars.service';
import {
  DEFAULT_AVATAR_CONSENT_TIMEOUT_MIN,
  DEFAULT_AVATAR_TRAINING_TIMEOUT_MIN,
} from '../avatars.constants';

/**
 * Reconciliation cron — covers failure modes the webhook can't handle:
 *   1. Webhook never arrives (delivery failure on HeyGen's side)
 *   2. Worker crashed mid-submit, leaving avatar stuck in SUBMITTING
 *   3. Consent approval — HeyGen has NO webhook event for consent, so
 *      PENDING_CONSENT avatars only advance via this polling.
 *
 * Runs every minute. For each avatar in SUBMITTING / TRAINING / PENDING_CONSENT:
 *   - Within the timeout window, polls HeyGen and reconciles state
 *     (AvatarsService.reconcileFromHeyGen is the single source of truth).
 *   - Past the timeout, marks FAILED + refunds credits. PENDING_CONSENT uses a
 *     much longer window (48h default) — the subject may approve hours later.
 */
@Injectable()
export class StuckAvatarsService {
  private readonly logger = new Logger(StuckAvatarsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly avatars: AvatarsService,
    private readonly configService: ConfigService,
  ) {}

  @Cron('* * * * *') // every minute
  async handleStuckAvatars(): Promise<void> {
    try {
      const hardTimeoutMin = this.getTimeoutMin(
        'AVATAR_TRAINING_TIMEOUT_MIN',
        DEFAULT_AVATAR_TRAINING_TIMEOUT_MIN,
      );
      const consentTimeoutMin = this.getTimeoutMin(
        'AVATAR_CONSENT_TIMEOUT_MIN',
        DEFAULT_AVATAR_CONSENT_TIMEOUT_MIN,
      );
      // Start polling 30s after submission — Photo Avatar finishes in seconds,
      // Digital Twin in minutes. Aggressive polling to keep UX snappy.
      const pollThreshold = new Date(Date.now() - 30_000);

      const stuck = await this.prisma.userAvatar.findMany({
        where: {
          isDeleted: false,
          status: {
            in: [AvatarStatus.SUBMITTING, AvatarStatus.TRAINING, AvatarStatus.PENDING_CONSENT],
          },
          OR: [
            { trainingStartedAt: { lt: pollThreshold } },
            { trainingStartedAt: null, createdAt: { lt: pollThreshold } },
          ],
        },
      });

      this.logger.log(`[stuck-avatars] tick — found ${stuck.length} avatar(s) to poll`);

      if (stuck.length === 0) return;

      for (const avatar of stuck) {
        try {
          const startedAt = avatar.trainingStartedAt ?? avatar.createdAt;
          const isConsentWait = avatar.status === AvatarStatus.PENDING_CONSENT;
          const timeoutMin = isConsentWait ? consentTimeoutMin : hardTimeoutMin;
          if (startedAt < new Date(Date.now() - timeoutMin * 60_000)) {
            await this.avatars.failAndRefundAvatar(
              avatar,
              isConsentWait
                ? 'O consentimento do avatar não foi aprovado a tempo. Crie o avatar novamente e aprove o consentimento pelo link.'
                : `Treinamento expirou por timeout (${timeoutMin} min).`,
            );
            continue;
          }
          if (!avatar.heygenGroupId) {
            // Stuck before HeyGen ever responded — likely worker crashed pre-call.
            // Cron alone can't recover this; we leave it to hard timeout to refund.
            this.logger.log(
              `[stuck-avatars] ${avatar.id} has no heygenGroupId yet, skipping until hard timeout`,
            );
            continue;
          }
          await this.avatars.reconcileFromHeyGen(avatar);
        } catch (err) {
          this.logger.error(
            `[stuck-avatars] failed to reconcile ${avatar.id}: ${err instanceof Error ? err.message : err}`,
          );
        }
      }
    } catch (err) {
      this.logger.error(
        `[stuck-avatars] cron failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  private getTimeoutMin(envKey: string, fallback: number): number {
    const raw = this.configService.get<string>(envKey);
    const parsed = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
