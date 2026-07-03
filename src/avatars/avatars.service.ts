import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  AiModelType,
  AvatarConsentStatus,
  AvatarStatus,
  GenerationStatus,
  GenerationType,
  Resolution,
  UserAvatar,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
import { CreditsService } from '../credits/credits.service';
import { ModelsService } from '../models/models.service';
import {
  HeyGenAvatarGroupSnapshot,
  HeyGenHttpError,
  HeyGenProvider,
} from './providers/heygen.provider';
import { AvatarEventsService } from './avatar-events.service';
import { CreateAvatarDto } from './dto/create-avatar.dto';
import { GenerateAvatarVideoDto } from './dto/generate-avatar-video.dto';
import {
  AvatarListResponseDto,
  AvatarQuotaDto,
  AvatarResponseDto,
} from './dto/avatar-response.dto';
import {
  DEFAULT_AVATAR_TRAINING_CREDITS,
  actualAvatarVideoCost,
  estimateAvatarVideoCost,
} from './avatars.constants';
import { AVATAR_QUEUE, AvatarJobName } from './queue/avatar-queue.constants';

@Injectable()
export class AvatarsService {
  private readonly logger = new Logger(AvatarsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadsService: UploadsService,
    private readonly creditsService: CreditsService,
    private readonly heygen: HeyGenProvider,
    private readonly configService: ConfigService,
    private readonly modelsService: ModelsService,
    private readonly events: AvatarEventsService,
    @InjectQueue(AVATAR_QUEUE) private readonly avatarQueue: Queue,
  ) {}

  // ─── Public API (used by controller) ──────────────────────────────────────

  async list(userId: string): Promise<AvatarListResponseDto> {
    const [avatars, quota] = await Promise.all([
      this.prisma.userAvatar.findMany({
        where: { userId, isDeleted: false },
        orderBy: { createdAt: 'desc' },
      }),
      this.getQuota(userId),
    ]);

    return {
      avatars: avatars.map((a) => this.toResponse(a)),
      quota,
    };
  }

  async get(userId: string, id: string): Promise<AvatarResponseDto> {
    const avatar = await this.findOwnedOrThrow(userId, id);
    return this.toResponse(avatar);
  }

  async create(userId: string, dto: CreateAvatarDto): Promise<AvatarResponseDto> {
    // Feature gate — admin can disable the entire avatar feature (cloning +
    // video gen) via the 'avatar-video' AiModel toggle. Blocking here prevents
    // users from spending credits on a clone they wouldn't be able to use.
    await this.modelsService.assertActiveBySlug('avatar-video', AiModelType.VIDEO);

    // Quota gating
    const quota = await this.getQuota(userId);
    if (!quota.enabled) {
      throw new ForbiddenException({
        code: 'PLAN_UPGRADE_REQUIRED',
        message: 'Clonagem de avatar requer um plano pago. Faça upgrade para criar.',
      });
    }
    if (quota.used >= quota.limit) {
      throw new ForbiddenException({
        code: 'AVATAR_QUOTA_EXCEEDED',
        message: `Limite de ${quota.limit} avatar(es) atingido. Exclua um existente ou faça upgrade.`,
      });
    }

    // Source media must come from /uploads/presigned-url with purpose 'avatar_source'
    if (!dto.sourceMediaKey.startsWith('avatar_source/')) {
      throw new BadRequestException(
        'sourceMediaKey inválido. Faça upload via /uploads/presigned-url com purpose "avatar_source".',
      );
    }
    const sourceMediaUrl = this.uploadsService.getPublicUrl(dto.sourceMediaKey);
    const avatarType: 'photo' | 'digital_twin' = dto.type ?? 'photo';

    const trainingCost = this.getTrainingCost(avatarType);

    // Pre-create the row so credits.transaction can reference userAvatarId.
    // We use a separate, short transaction here; actual debit happens after.
    const created = await this.prisma.userAvatar.create({
      data: {
        userId,
        name: dto.name.trim(),
        status: AvatarStatus.PENDING,
        // Photo avatars never require consent; digital twins do
        consentStatus: AvatarConsentStatus.NOT_REQUIRED,
        sourceVideoKey: dto.sourceMediaKey, // schema field name kept for compat
        sourceVideoUrl: sourceMediaUrl,
        creditsConsumed: trainingCost,
      },
    });

    // Debit credits — if this throws (insufficient), rollback by deleting the row.
    try {
      await this.creditsService.debitForAvatar(
        userId,
        trainingCost,
        created.id,
        `Treinamento de avatar: ${created.name}`,
      );
    } catch (err) {
      await this.prisma.userAvatar.delete({ where: { id: created.id } }).catch(() => {});
      throw err;
    }

    // Enqueue submission to HeyGen — worker handles status transitions and refund on failure
    await this.avatarQueue.add(
      AvatarJobName.SUBMIT_TRAINING,
      { userAvatarId: created.id, avatarType },
      {
        jobId: `submit-${created.id}`, // dedupe accidental re-enqueues
        attempts: 2,
        backoff: { type: 'fixed', delay: 30_000 },
        removeOnComplete: { age: 24 * 3600 },
        removeOnFail: { age: 7 * 24 * 3600 },
      },
    );

    return this.toResponse(created);
  }

  async generateVideo(
    userId: string,
    avatarId: string,
    dto: GenerateAvatarVideoDto,
  ): Promise<{ generationId: string; status: GenerationStatus; creditsConsumed: number }> {
    // Feature gate — admin can disable avatar video generation via the
    // 'avatar-video' AiModel toggle. Throws MODEL_DISABLED with the admin's
    // status message if off.
    await this.modelsService.assertActiveBySlug('avatar-video', AiModelType.VIDEO);

    const avatar = await this.findOwnedOrThrow(userId, avatarId);

    if (avatar.status !== AvatarStatus.READY) {
      throw new BadRequestException({
        code: 'AVATAR_NOT_READY',
        message: `Avatar ainda não está pronto (status: ${avatar.status}).`,
      });
    }
    if (!avatar.heygenLookId) {
      throw new BadRequestException(
        'Avatar não tem look_id da HeyGen. Aguarde a sincronização concluir.',
      );
    }

    // If the user picked a cloned voice, validate ownership upfront — fail fast
    // before debiting credits or enqueueing.
    if (dto.voiceProfileId) {
      const voice = await this.prisma.voiceProfile.findFirst({
        where: { id: dto.voiceProfileId, userId, isDeleted: false, status: 'READY' },
        select: { id: true },
      });
      if (!voice) {
        throw new BadRequestException({
          code: 'VOICE_NOT_FOUND',
          message: 'Voz clonada não encontrada ou não está pronta.',
        });
      }
    }

    // Mode 'custom audio' is mutually exclusive with TTS inputs. The DTO marks
    // script optional when customAudioKey is present; enforce the other half
    // here so we don't silently ignore voice settings the user thought applied.
    let customAudioUrl: string | null = null;
    if (dto.customAudioKey) {
      if (!dto.customAudioKey.startsWith('avatar_audio/')) {
        throw new BadRequestException(
          'customAudioKey inválido. Faça upload via /uploads/presigned-url com purpose "avatar_audio".',
        );
      }
      if (dto.script || dto.voiceId || dto.voiceProfileId || dto.inworldVoiceId) {
        throw new BadRequestException({
          code: 'AUDIO_MODE_CONFLICT',
          message:
            'No modo "áudio próprio" não envie script/voiceId/voiceProfileId/inworldVoiceId.',
        });
      }
      if (!dto.audioDurationSeconds) {
        throw new BadRequestException({
          code: 'AUDIO_DURATION_REQUIRED',
          message: 'Informe a duração do áudio (audioDurationSeconds).',
        });
      }
      customAudioUrl = this.uploadsService.getPublicUrl(dto.customAudioKey);
    } else if (!dto.script) {
      // Without customAudioKey, the script is required.
      throw new BadRequestException({
        code: 'SCRIPT_REQUIRED',
        message: 'Forneça um roteiro (script) ou um áudio próprio (customAudioKey).',
      });
    }

    // Engine fallback: if user requested avatar_v but look doesn't support it, downgrade
    let engine = dto.engine ?? 'avatar_iv';
    if (engine === 'avatar_v' && !avatar.supportedEngines.includes('avatar_v')) {
      engine = 'avatar_iv';
    }

    // Cost calculation:
    //  - Custom audio mode → exact (we know the duration up front)
    //  - Script/TTS mode → estimate (script length × cps); webhook reconciles
    const cost = customAudioUrl
      ? actualAvatarVideoCost(dto.resolution, dto.audioDurationSeconds!)
      : estimateAvatarVideoCost(dto.resolution, dto.script!.length);

    // Map our DTO resolution to Prisma Resolution enum
    const prismaRes: Resolution =
      dto.resolution === '720p'
        ? Resolution.RES_720P
        : dto.resolution === '1080p'
          ? Resolution.RES_1080P
          : Resolution.RES_4K;

    // Create generation row first so credits link to it
    const generation = await this.prisma.generation.create({
      data: {
        userId,
        userAvatarId: avatar.id,
        type: GenerationType.AVATAR_VIDEO,
        status: GenerationStatus.PENDING,
        prompt: dto.script ?? null,
        resolution: prismaRes,
        aspectRatio: dto.aspectRatio,
        modelUsed: `heygen-${engine}`,
        creditsConsumed: cost,
        parameters: {
          script: dto.script ?? null,
          voiceId: dto.voiceId ?? null,
          voiceProfileId: dto.voiceProfileId ?? null,
          inworldVoiceId: dto.inworldVoiceId ?? null,
          customAudioUrl: customAudioUrl ?? null,
          customAudioKey: dto.customAudioKey ?? null,
          audioDurationSeconds: dto.audioDurationSeconds ?? null,
          engine,
          resolution: dto.resolution,
          aspectRatio: dto.aspectRatio,
          backgroundColor: dto.backgroundColor ?? null,
          backgroundImageUrl: dto.backgroundImageUrl ?? null,
        },
        // Link to the cloned VoiceProfile so it shows up in usage history
        ...(dto.voiceProfileId && { voiceProfileId: dto.voiceProfileId }),
      },
    });

    // Debit. On failure, rollback the generation row.
    try {
      await this.creditsService.debit(
        userId,
        cost,
        'GENERATION_DEBIT' as any,
        generation.id,
        `Vídeo com avatar ${avatar.name}`,
      );
    } catch (err) {
      await this.prisma.generation.delete({ where: { id: generation.id } }).catch(() => {});
      throw err;
    }

    await this.enqueueGenerateVideo({
      userId,
      userAvatarId: avatar.id,
      generationId: generation.id,
      creditsConsumed: cost,
    });

    return {
      generationId: generation.id,
      status: GenerationStatus.PENDING,
      creditsConsumed: cost,
    };
  }

  async remove(userId: string, id: string): Promise<void> {
    const avatar = await this.findOwnedOrThrow(userId, id);

    // Block delete during active training (per product decision: no cancel during
    // training). PENDING_CONSENT fica de fora: a espera é do usuário (aprovar o
    // link da HeyGen) e pode durar horas — ele precisa poder desistir do avatar.
    if (
      avatar.status === AvatarStatus.SUBMITTING ||
      avatar.status === AvatarStatus.TRAINING
    ) {
      throw new ConflictException({
        code: 'AVATAR_IS_TRAINING',
        message: 'Não é possível excluir um avatar durante o treinamento. Aguarde concluir.',
      });
    }

    // Mark deleting first so concurrent reads see the intent
    await this.prisma.userAvatar.update({
      where: { id: avatar.id },
      data: { status: AvatarStatus.DELETING },
    });

    // Best-effort cleanup at HeyGen
    if (avatar.heygenGroupId) {
      await this.heygen.deleteAvatarGroup(avatar.heygenGroupId);
    }

    // Best-effort cleanup of source video on R2
    if (avatar.sourceVideoKey) {
      const folderPrefix = avatar.sourceVideoKey.split('/').slice(0, -1).join('/') + '/';
      await this.uploadsService.deleteByPrefix(folderPrefix).catch((err) => {
        this.logger.warn(
          `Failed to delete S3 prefix ${folderPrefix}: ${err instanceof Error ? err.message : err}`,
        );
      });
    }

    await this.prisma.userAvatar.update({
      where: { id: avatar.id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    this.logger.log(`Avatar ${avatar.id} soft-deleted for user ${userId}`);
  }

  // ─── Reconciliação com a HeyGen ────────────────────────────────────────────

  /**
   * Reconcilia o estado local do avatar com o snapshot da HeyGen. Fonte única
   * de verdade para as transições TRAINING → PENDING_CONSENT / READY / FAILED,
   * usada pelo webhook de sucesso e pelo cron de reconciliação.
   *
   * Regras aprendidas do incidente do look placeholder (2026-07-02):
   *  - `consent_status` é null para photo avatars; não-nulo = digital twin,
   *    que só pode ficar READY com consentimento aprovado.
   *  - Enquanto o consentimento está pendente, a HeyGen esconde os looks do
   *    grupo e o id salvo na criação é um placeholder que o POST /v3/videos
   *    rejeita ("avatar is not supported"). Portanto, digital twin só vira
   *    READY quando um look real for resolvido via /v3/avatars/looks.
   */
  async reconcileFromHeyGen(avatar: UserAvatar): Promise<void> {
    if (!avatar.heygenGroupId) return;

    let snapshot: HeyGenAvatarGroupSnapshot;
    try {
      snapshot = await this.heygen.getAvatarGroup(avatar.heygenGroupId);
    } catch (err) {
      // Grupo não existe mais na HeyGen (ex.: exclusão concluída do lado deles):
      // o avatar nunca vai concluir — falha e estorna em vez de esperar timeout.
      if (err instanceof HeyGenHttpError && err.status === 404) {
        await this.failAndRefundAvatar(
          avatar,
          'O avatar não existe mais na HeyGen. Crie o avatar novamente.',
          'heygen_group_not_found',
        );
        return;
      }
      throw err;
    }
    this.logger.log(
      `[avatar-reconcile] avatar=${avatar.id} status=${snapshot.status} consent=${snapshot.consentStatus} looks=${snapshot.looks.length}`,
    );

    if (snapshot.status === 'failed' || snapshot.errorCode) {
      await this.failAndRefundAvatar(
        avatar,
        snapshot.errorMessage ?? 'Treinamento falhou na HeyGen.',
        snapshot.errorCode ?? null,
      );
      return;
    }

    if (snapshot.consentStatus === 'rejected') {
      await this.failAndRefundAvatar(
        avatar,
        'O consentimento do avatar foi recusado na HeyGen.',
        'consent_rejected',
      );
      return;
    }

    const requiresConsent = snapshot.consentStatus !== null;
    const consentPending = requiresConsent && snapshot.consentStatus !== 'approved';

    if (consentPending) {
      // Garante que o usuário tem um link para aprovar. Não há webhook de
      // consent — o cron detecta a aprovação por polling deste método.
      let consentUrl = avatar.consentUrl;
      if (!consentUrl) {
        try {
          const consent = await this.heygen.initiateConsent(avatar.heygenGroupId, avatar.id);
          consentUrl = consent.url;
        } catch (err) {
          this.logger.warn(
            `[avatar-reconcile] initiateConsent failed for ${avatar.id}: ${
              err instanceof Error ? err.message : err
            }`,
          );
        }
      }

      // Só vira PENDING_CONSENT quando o treino terminou (é quando o card do
      // front mostra o botão de aprovar); antes disso continua TRAINING.
      const nextStatus =
        snapshot.status === 'completed' ? AvatarStatus.PENDING_CONSENT : AvatarStatus.TRAINING;
      const changed =
        avatar.status !== nextStatus ||
        avatar.consentStatus !== AvatarConsentStatus.PENDING ||
        consentUrl !== avatar.consentUrl;
      if (changed) {
        const updated = await this.prisma.userAvatar.update({
          where: { id: avatar.id },
          data: {
            status: nextStatus,
            consentStatus: AvatarConsentStatus.PENDING,
            consentUrl,
          },
        });
        this.events.emit({
          userId: avatar.userId,
          userAvatarId: avatar.id,
          status: nextStatus,
          consentStatus: updated.consentStatus,
          data: { consentUrl: updated.consentUrl },
        });
      }
      return;
    }

    if (snapshot.status === 'completed') {
      const primaryLook =
        snapshot.looks.find((l) => l.lookId === avatar.heygenLookId) ?? snapshot.looks[0] ?? null;

      // Digital twin sem look visível: o id salvo na criação é um placeholder
      // que o POST /v3/videos rejeita. Aguarda a HeyGen expor o look real
      // (o cron re-tenta a cada minuto até o hard timeout).
      if (requiresConsent && !primaryLook) {
        this.logger.warn(
          `[avatar-reconcile] ${avatar.id} completed + consent ok, mas sem looks visíveis — aguardando a HeyGen expor o look real`,
        );
        return;
      }

      const resolvedLookId = primaryLook?.lookId ?? avatar.heygenLookId;
      if (primaryLook && primaryLook.lookId !== avatar.heygenLookId) {
        this.logger.log(
          `[avatar-reconcile] resolving heygenLookId for ${avatar.id}: ${avatar.heygenLookId} → ${primaryLook.lookId}`,
        );
      }

      const updated = await this.prisma.userAvatar.update({
        where: { id: avatar.id },
        data: {
          status: AvatarStatus.READY,
          trainingCompletedAt: avatar.trainingCompletedAt ?? new Date(),
          heygenLookId: resolvedLookId,
          ...(requiresConsent && {
            consentStatus: AvatarConsentStatus.APPROVED,
            consentApprovedAt: avatar.consentApprovedAt ?? new Date(),
          }),
          // Campos do grupo servem de fallback quando o look vem com nulls
          // (comum em avatares recém-treinados).
          previewImageUrl:
            primaryLook?.previewImageUrl ??
            snapshot.groupPreviewImageUrl ??
            avatar.previewImageUrl,
          previewVideoUrl: primaryLook?.previewVideoUrl ?? avatar.previewVideoUrl,
          defaultVoiceId:
            primaryLook?.defaultVoiceId ??
            snapshot.groupDefaultVoiceId ??
            avatar.defaultVoiceId,
          supportedEngines: primaryLook?.supportedEngines ?? avatar.supportedEngines,
        },
      });

      if (avatar.status !== AvatarStatus.READY) {
        this.events.emit({
          userId: avatar.userId,
          userAvatarId: avatar.id,
          status: AvatarStatus.READY,
          consentStatus: updated.consentStatus,
          data: { previewImageUrl: updated.previewImageUrl },
        });
        this.logger.log(`[avatar-reconcile] ${avatar.id} marcado READY (look=${resolvedLookId})`);
      }
      return;
    }

    // Ainda processando — garante TRAINING local
    if (
      avatar.status !== AvatarStatus.TRAINING &&
      avatar.status !== AvatarStatus.PENDING_CONSENT
    ) {
      await this.prisma.userAvatar.update({
        where: { id: avatar.id },
        data: { status: AvatarStatus.TRAINING },
      });
      this.events.emit({
        userId: avatar.userId,
        userAvatarId: avatar.id,
        status: AvatarStatus.TRAINING,
        consentStatus: avatar.consentStatus,
      });
    }
  }

  /**
   * Marca FAILED e estorna os créditos do treinamento. Idempotente: o update
   * condicional garante um único estorno mesmo se webhook e cron dispararem
   * ao mesmo tempo (refundForAvatar não tem guarda própria).
   */
  async failAndRefundAvatar(
    avatar: UserAvatar,
    errorMessage: string,
    errorCode: string | null = null,
  ): Promise<void> {
    const { count } = await this.prisma.userAvatar.updateMany({
      where: { id: avatar.id, status: { not: AvatarStatus.FAILED } },
      data: {
        status: AvatarStatus.FAILED,
        errorMessage: errorMessage.slice(0, 500),
        errorCode: errorCode?.slice(0, 100),
      },
    });
    if (count === 0) return; // já estava FAILED — estorno já aconteceu

    await this.creditsService
      .refundForAvatar(avatar.userId, avatar.id, avatar.creditsConsumed)
      .catch((err) => {
        this.logger.error(
          `refund failed for avatar ${avatar.id}: ${err instanceof Error ? err.message : err}`,
        );
      });
    this.events.emit({
      userId: avatar.userId,
      userAvatarId: avatar.id,
      status: AvatarStatus.FAILED,
      data: { errorMessage, errorCode },
    });
    this.logger.warn(`Avatar ${avatar.id} marcado FAILED + estorno de ${avatar.creditsConsumed}cr`);
  }

  // ─── Internals ────────────────────────────────────────────────────────────

  /**
   * Public helper used by the generate-video endpoint to enqueue a HeyGen
   * video render. The Generation row is created by the caller before
   * enqueueing — this just dispatches the job.
   */
  async enqueueGenerateVideo(input: {
    userId: string;
    userAvatarId: string;
    generationId: string;
    creditsConsumed: number;
  }): Promise<void> {
    await this.avatarQueue.add(
      AvatarJobName.GENERATE_VIDEO,
      input,
      {
        jobId: `generate-video-${input.generationId}`,
        attempts: 1,
        removeOnComplete: { age: 24 * 3600 },
        removeOnFail: { age: 7 * 24 * 3600 },
      },
    );
  }

  private async findOwnedOrThrow(userId: string, id: string): Promise<UserAvatar> {
    const avatar = await this.prisma.userAvatar.findFirst({
      where: { id, userId, isDeleted: false },
    });
    if (!avatar) {
      throw new NotFoundException('Avatar não encontrado.');
    }
    return avatar;
  }

  async getQuota(userId: string): Promise<AvatarQuotaDto> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { userId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      select: { plan: { select: { slug: true, avatar_clone_enabled: true, avatar_clone_limit: true } } },
    });

    const plan = subscription?.plan;
    const planSlug = plan?.slug ?? 'free';
    const enabled = plan?.avatar_clone_enabled ?? false;
    const limit = plan?.avatar_clone_limit ?? 0;

    const used = await this.prisma.userAvatar.count({
      where: {
        userId,
        isDeleted: false,
        status: { not: AvatarStatus.FAILED },
      },
    });

    return { used, limit, enabled, planSlug };
  }

  private getTrainingCost(avatarType: 'photo' | 'digital_twin'): number {
    const envKey =
      avatarType === 'photo'
        ? 'AVATAR_TRAINING_CREDITS_PHOTO'
        : 'AVATAR_TRAINING_CREDITS_DIGITAL_TWIN';
    const raw = this.configService.get<string>(envKey);
    const parsed = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(parsed) && parsed > 0
      ? parsed
      : DEFAULT_AVATAR_TRAINING_CREDITS[avatarType];
  }

  private toResponse(avatar: UserAvatar): AvatarResponseDto {
    return {
      id: avatar.id,
      name: avatar.name,
      status: avatar.status,
      consentStatus: avatar.consentStatus,
      previewImageUrl: avatar.previewImageUrl,
      previewVideoUrl: avatar.previewVideoUrl,
      defaultVoiceId: avatar.defaultVoiceId,
      supportedEngines: avatar.supportedEngines ?? [],
      consentUrl: avatar.consentUrl,
      consentApprovedAt: avatar.consentApprovedAt,
      errorMessage: avatar.errorMessage,
      errorCode: avatar.errorCode,
      creditsConsumed: avatar.creditsConsumed,
      trainingStartedAt: avatar.trainingStartedAt,
      trainingCompletedAt: avatar.trainingCompletedAt,
      createdAt: avatar.createdAt,
    };
  }
}
