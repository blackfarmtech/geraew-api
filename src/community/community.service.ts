import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CommunityPostStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SubmitCommunityPostDto } from './dto/community.dto';

function kindOf(type: string): 'image' | 'video' | null {
  const t = type.toUpperCase();
  if (t.includes('VIDEO') || t.includes('MOTION')) return 'video';
  if (t.includes('SPEECH') || t.includes('VOICE') || t.includes('AUDIO'))
    return null;
  return 'image';
}

@Injectable()
export class CommunityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Envia uma geração para aprovação na comunidade. */
  async submit(userId: string, dto: SubmitCommunityPostDto) {
    const generation = await this.prisma.generation.findUnique({
      where: { id: dto.generationId },
      include: { outputs: { orderBy: { order: 'asc' } } },
    });

    if (!generation || generation.isDeleted)
      throw new NotFoundException('Geracao nao encontrada');
    if (generation.userId !== userId)
      throw new ForbiddenException('Acesso negado');
    if (generation.status !== 'COMPLETED')
      throw new BadRequestException('A geracao ainda nao foi concluida');

    const kind = kindOf(generation.type);
    if (!kind)
      throw new BadRequestException(
        'Apenas imagens e videos podem ser publicados na comunidade',
      );

    const output = dto.outputUrl
      ? generation.outputs.find((o) => o.url === dto.outputUrl)
      : generation.outputs[0];
    if (!output) throw new BadRequestException('Geracao sem midia disponivel');

    // evita reenvio do mesmo conteúdo enquanto pendente/aprovado
    const existing = await this.prisma.communityPost.findFirst({
      where: {
        generationId: generation.id,
        mediaUrl: output.url,
        status: { in: ['PENDING', 'APPROVED'] },
      },
    });
    if (existing)
      throw new BadRequestException(
        'Este conteudo ja foi enviado para a comunidade',
      );

    const params = (generation.parameters ?? {}) as Record<string, unknown>;
    const settings = [
      generation.aspectRatio ?? (params.aspect_ratio as string | undefined),
      generation.modelUsed,
    ].filter(Boolean);

    const post = await this.prisma.communityPost.create({
      data: {
        userId,
        generationId: generation.id,
        kind,
        mediaUrl: output.url,
        thumbnailUrl: output.thumbnailUrl,
        prompt: generation.prompt ?? '',
        settings: settings as Prisma.InputJsonValue,
      },
    });

    await this.notifications.create(userId, 'community-submitted', {
      postId: post.id,
    });

    return post;
  }

  /** Feed público (posts aprovados) com likedByMe. */
  async feed(userId: string, page = 1, limit = 30) {
    const where = { status: CommunityPostStatus.APPROVED };
    const [posts, total] = await Promise.all([
      this.prisma.communityPost.findMany({
        where,
        orderBy: { approvedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { name: true, avatarUrl: true } } },
      }),
      this.prisma.communityPost.count({ where }),
    ]);

    const likedIds = new Set(
      (
        await this.prisma.communityPostLike.findMany({
          where: { userId, postId: { in: posts.map((p) => p.id) } },
          select: { postId: true },
        })
      ).map((l) => l.postId),
    );

    return {
      data: posts.map((p) => ({
        id: p.id,
        kind: p.kind,
        mediaUrl: p.mediaUrl,
        thumbnailUrl: p.thumbnailUrl,
        prompt: p.prompt,
        settings: p.settings,
        likesCount: p.likesCount,
        likedByMe: likedIds.has(p.id),
        createdAt: p.createdAt,
        author: { name: p.user.name, avatarUrl: p.user.avatarUrl },
      })),
      meta: { page, limit, total },
    };
  }

  /** Posts do próprio usuário (com status/motivo). */
  async mine(userId: string) {
    return this.prisma.communityPost.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async like(userId: string, postId: string) {
    const post = await this.prisma.communityPost.findUnique({
      where: { id: postId },
    });
    if (!post || post.status !== 'APPROVED')
      throw new NotFoundException('Post nao encontrado');

    try {
      await this.prisma.$transaction([
        this.prisma.communityPostLike.create({ data: { postId, userId } }),
        this.prisma.communityPost.update({
          where: { id: postId },
          data: { likesCount: { increment: 1 } },
        }),
      ]);
    } catch (error) {
      // like duplicado (unique post+user) — idempotente
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return { liked: true, likesCount: post.likesCount };
      }
      throw error;
    }

    return { liked: true, likesCount: post.likesCount + 1 };
  }

  async unlike(userId: string, postId: string) {
    const post = await this.prisma.communityPost.findUnique({
      where: { id: postId },
    });
    if (!post) throw new NotFoundException('Post nao encontrado');

    const { count } = await this.prisma.communityPostLike.deleteMany({
      where: { postId, userId },
    });
    if (count > 0) {
      await this.prisma.communityPost.update({
        where: { id: postId },
        data: { likesCount: { decrement: 1 } },
      });
    }
    return { liked: false, likesCount: Math.max(0, post.likesCount - count) };
  }

  // ─── Admin ──────────────────────────────────────────────────────────────────

  async adminList(
    status: CommunityPostStatus = 'PENDING',
    page = 1,
    limit = 30,
  ) {
    const where = { status };
    const [posts, total] = await Promise.all([
      this.prisma.communityPost.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.communityPost.count({ where }),
    ]);
    return { data: posts, meta: { page, limit, total } };
  }

  async approve(postId: string) {
    const post = await this.prisma.communityPost.findUnique({
      where: { id: postId },
    });
    if (!post) throw new NotFoundException('Post nao encontrado');

    const updated = await this.prisma.communityPost.update({
      where: { id: postId },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        rejectionReason: null,
      },
    });

    await this.notifications.create(post.userId, 'community-approved', {
      postId: post.id,
    });

    return updated;
  }

  async adminDelete(postId: string) {
    const post = await this.prisma.communityPost.findUnique({
      where: { id: postId },
    });
    if (!post) throw new NotFoundException('Post nao encontrado');
    // likes caem em cascata (FK onDelete: Cascade)
    await this.prisma.communityPost.delete({ where: { id: postId } });
    return { success: true };
  }

  async reject(postId: string, reason?: string) {
    const post = await this.prisma.communityPost.findUnique({
      where: { id: postId },
    });
    if (!post) throw new NotFoundException('Post nao encontrado');

    const updated = await this.prisma.communityPost.update({
      where: { id: postId },
      data: {
        status: 'REJECTED',
        ...(reason !== undefined && { rejectionReason: reason }),
      },
    });

    await this.notifications.create(post.userId, 'community-rejected', {
      postId: post.id,
      ...(reason && { reason }),
    });

    return updated;
  }
}
