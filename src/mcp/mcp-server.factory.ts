import { Injectable, Logger } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { Resolution } from '@prisma/client';
import { GenerationsService } from '../generations/generations.service';
import { CreditsService } from '../credits/credits.service';
import type { GenerateImageDto } from '../generations/dto/generate-image.dto';
import type { GenerateVideoTextToVideoDto } from '../generations/dto/videos/generate-video-text-to-video.dto';
import type { GenerateVideoImageToVideoDto } from '../generations/dto/videos/generate-video-image-to-video.dto';
import type { GenerateFaceSwapDto } from '../generations/dto/generate-face-swap.dto';
import sharp = require('sharp');

const IMAGE_GEN_TYPES = [
  'TEXT_TO_IMAGE',
  'IMAGE_TO_IMAGE',
  'FACE_SWAP',
  'VIRTUAL_TRY_ON',
];

const IMAGE_RES: Record<string, Resolution> = {
  '1k': Resolution.RES_1K,
  '2k': Resolution.RES_2K,
  '4k': Resolution.RES_4K,
};
const VIDEO_RES: Record<string, Resolution> = {
  '720p': Resolution.RES_720P,
  '1080p': Resolution.RES_1080P,
  '4k': Resolution.RES_4K,
};

// Friendly image-model names shown to the assistant → internal GeraEW slugs.
const IMAGE_MODEL_MAP: Record<string, string> = {
  'Nano Banana 2': 'gemini-3.1-flash-image-preview',
  'Nano Banana Pro': 'gemini-3-pro-image-preview',
  'GPT Image 2': 'gpt-image-2',
  'Geraew Unlocked': 'sem-censura',
};

const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

/** Minimal, non-generic view of McpServer.registerTool to keep tsc cheap. */
interface RegisterableServer {
  registerTool(
    name: string,
    config: Record<string, unknown>,
    handler: (args: any) => Promise<unknown>,
  ): void;
}

/**
 * Builds a per-user MCP server. Every tool call runs as the authenticated
 * GeraEW user (their plan, their credits) by calling the domain services
 * in-process. Inputs are given as public image URLs (fetched server-side);
 * outputs are returned as CDN URLs.
 */
@Injectable()
export class McpServerFactory {
  private readonly logger = new Logger(McpServerFactory.name);

  constructor(
    private readonly generations: GenerationsService,
    private readonly credits: CreditsService,
  ) {}

  build(userId: string): McpServer {
    const server = new McpServer({ name: 'geraew', version: '1.0.0' });
    // Register via a loosely-typed reference: the zod raw-shape generics on
    // registerTool are extremely expensive to infer and blow up tsc's heap
    // when combined with this project's large type graph.
    this.registerTools(server as unknown as RegisterableServer, userId);
    return server;
  }

  private async fetchToBase64(
    url: string,
  ): Promise<{ base64: string; mime: string }> {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Could not fetch image URL (HTTP ${res.status})`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const mime = (res.headers.get('content-type') ?? 'image/png').split(';')[0];
    return { base64: buf.toString('base64'), mime };
  }

  /** Polls a generation until terminal (or timeout); returns the final DTO. */
  private async waitFor(
    userId: string,
    id: string,
    maxMs: number,
  ): Promise<any> {
    const deadline = Date.now() + maxMs;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const gen: any = await this.generations.findById(userId, id);
      if (gen.status === 'COMPLETED' || gen.status === 'FAILED') return gen;
      if (Date.now() >= deadline) return gen;
      await sleep(3000);
    }
  }

  private result(value: unknown): {
    content: Array<{ type: 'text'; text: string }>;
    structuredContent?: Record<string, unknown>;
  } {
    const structured =
      value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : { data: value };
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
      structuredContent: structured,
    };
  }

  private errorResult(error: unknown): {
    content: Array<{ type: 'text'; text: string }>;
    isError: true;
  } {
    const message =
      (error as any)?.response?.error?.message ??
      (error as any)?.message ??
      String(error);
    return {
      content: [{ type: 'text' as const, text: `Error: ${message}` }],
      isError: true,
    };
  }

  private summarize(gen: any): Record<string, unknown> {
    return {
      id: gen.id,
      status: gen.status,
      type: gen.type,
      model_used: gen.modelUsed,
      resolution: gen.resolution,
      credits_consumed: gen.creditsConsumed,
      has_watermark: gen.hasWatermark,
      error_message: gen.errorMessage,
      urls: Array.isArray(gen.outputs)
        ? gen.outputs.map((o: any) => o.url)
        : [],
    };
  }

  /**
   * Fetches an image URL and returns a lightweight base64 JPEG preview (max
   * 1024px, quality 80) so it can be rendered inline in the chat without
   * shipping the full-resolution file. Returns null on any failure.
   */
  private async inlinePreview(
    url: string,
  ): Promise<{ data: string; mimeType: string } | null> {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const input = Buffer.from(await res.arrayBuffer());
      const out = await sharp(input)
        .rotate()
        .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
      return { data: out.toString('base64'), mimeType: 'image/jpeg' };
    } catch {
      return null;
    }
  }

  /**
   * Builds a tool result for a finished generation: a text summary plus inline
   * image previews (the images themselves, or a video's thumbnail).
   */
  private async mediaResult(gen: any): Promise<{
    content: Array<Record<string, unknown>>;
    structuredContent: Record<string, unknown>;
  }> {
    const summary = this.summarize(gen);
    const content: Array<Record<string, unknown>> = [
      { type: 'text', text: JSON.stringify(summary, null, 2) },
    ];

    if (gen.status === 'COMPLETED' && Array.isArray(gen.outputs)) {
      const isImageGen = IMAGE_GEN_TYPES.includes(gen.type);
      for (const o of gen.outputs.slice(0, 4)) {
        const isImage =
          isImageGen || (o.mimeType ?? '').startsWith('image/');
        const src = isImage ? o.url : o.thumbnailUrl; // video → thumbnail
        if (!src) continue;
        const preview = await this.inlinePreview(src);
        if (preview) {
          content.push({
            type: 'image',
            data: preview.data,
            mimeType: preview.mimeType,
          });
        }
      }
    }

    return { content, structuredContent: summary };
  }

  /**
   * Aggregates a batch of finished generations into one result: a text summary
   * of all jobs plus inline previews of every completed image (capped).
   */
  private async mediaResultMany(
    gens: any[],
    errors: string[] = [],
  ): Promise<{
    content: Array<Record<string, unknown>>;
    structuredContent: Record<string, unknown>;
  }> {
    const ok = gens.filter(Boolean);
    const summary = {
      requested: gens.length + errors.length,
      completed: ok.filter((g) => g.status === 'COMPLETED').length,
      failed:
        errors.length + ok.filter((g) => g.status === 'FAILED').length,
      total_credits: ok.reduce(
        (sum, g) => sum + (g.creditsConsumed ?? 0),
        0,
      ),
      generations: ok.map((g) => this.summarize(g)),
      ...(errors.length ? { errors } : {}),
    };

    const content: Array<Record<string, unknown>> = [
      { type: 'text', text: JSON.stringify(summary, null, 2) },
    ];

    // Collect one inline preview per completed image output, capped at 8 total.
    let previews = 0;
    for (const g of ok) {
      if (g.status !== 'COMPLETED' || !Array.isArray(g.outputs)) continue;
      const isImageGen = IMAGE_GEN_TYPES.includes(g.type);
      for (const o of g.outputs) {
        if (previews >= 8) break;
        const isImage = isImageGen || (o.mimeType ?? '').startsWith('image/');
        const src = isImage ? o.url : o.thumbnailUrl;
        if (!src) continue;
        const preview = await this.inlinePreview(src);
        if (preview) {
          content.push({
            type: 'image',
            data: preview.data,
            mimeType: preview.mimeType,
          });
          previews++;
        }
      }
    }

    return { content, structuredContent: summary };
  }

  private registerTools(server: RegisterableServer, userId: string): void {
    const waitControls = {
      wait: z
        .boolean()
        .default(true)
        .describe('Wait for the job to finish and return the output URLs.'),
      max_wait_seconds: z
        .number()
        .int()
        .min(10)
        .max(600)
        .optional()
        .describe('Max seconds to wait when wait=true.'),
    };

    // ── Image ──────────────────────────────────────────────────────────
    server.registerTool(
      'geraew_generate_image',
      {
        title: 'Generate Image',
        description:
          'Generate one or more images from a text prompt, or edit/remix reference images when image_urls are provided. Set count>1 to generate several images IN PARALLEL from the same prompt (one batch, fired simultaneously) — use this instead of calling the tool repeatedly. Returns inline previews + CDN URLs.',
        inputSchema: {
          prompt: z.string().min(1),
          count: z
            .number()
            .int()
            .min(1)
            .max(8)
            .default(1)
            .describe(
              'How many images to generate in parallel from this prompt (fired simultaneously). Each consumes credits. Plan concurrency limits apply.',
            ),
          model: z
            .enum(['Nano Banana 2', 'Nano Banana Pro', 'GPT Image 2', 'Geraew Unlocked'])
            .default('Nano Banana 2')
            .describe(
              'Modelo de imagem (escolha conforme o pedido do usuário; senão use o padrão):\n' +
                '• "Nano Banana 2" — rápido e ótimo custo-benefício. 90/130/190 créditos em 1K/2K/4K. (padrão)\n' +
                '• "Nano Banana Pro" — máxima qualidade e aderência ao prompt. 190/190/250 créditos em 1K/2K/4K.\n' +
                '• "GPT Image 2" — melhor para texto/tipografia e composições. 90/130/190 créditos em 1K/2K/4K. Não suporta 4K em proporção 1:1.\n' +
                '• "Geraew Unlocked" — geração sem censura. Apenas 2K/4K (130/190 créditos); 1K é elevado para 2K.',
            ),
          resolution: z.enum(['1k', '2k', '4k']).default('2k'),
          aspect_ratio: z
            .enum(['1:1', '3:2', '2:3', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'])
            .optional(),
          image_urls: z
            .array(z.string().url())
            .max(6)
            .optional()
            .describe('Public image URLs to use as references (image-to-image).'),
          ...waitControls,
        },
        annotations: { readOnlyHint: false, openWorldHint: true },
      },
      async (p) => {
        try {
          const images = p.image_urls
            ? await Promise.all(
                p.image_urls.map(async (u) => {
                  const { base64, mime } = await this.fetchToBase64(u);
                  return {
                    base64,
                    mime_type: mime === 'image/jpeg' ? 'image/jpeg' : 'image/png',
                  };
                }),
              )
            : undefined;
          const modelSlug =
            IMAGE_MODEL_MAP[p.model] ?? 'gemini-3.1-flash-image-preview';
          // Geraew Unlocked (sem-censura) only supports 2K/4K.
          let resKey = p.resolution;
          if (modelSlug === 'sem-censura' && resKey === '1k') resKey = '2k';
          const dto = {
            prompt: p.prompt,
            model: modelSlug,
            resolution: IMAGE_RES[resKey],
            ...(p.aspect_ratio ? { aspect_ratio: p.aspect_ratio } : {}),
            ...(images ? { images } : {}),
          } as GenerateImageDto;

          const count = p.count ?? 1;

          // Single image → keep the simple/rich single result.
          if (count === 1) {
            const created = await this.generations.generateImage(userId, dto);
            if (!p.wait)
              return this.result({ id: created.id, status: created.status });
            const gen = await this.waitFor(
              userId,
              created.id,
              (p.max_wait_seconds ?? 180) * 1000,
            );
            return await this.mediaResult(gen);
          }

          // Batch → fire all generations simultaneously.
          const errors: string[] = [];
          const settled = await Promise.all(
            Array.from({ length: count }, () =>
              this.generations
                .generateImage(userId, dto)
                .catch((e: any) => {
                  errors.push(
                    e?.response?.error?.message ?? e?.message ?? String(e),
                  );
                  return null;
                }),
            ),
          );
          const created = settled.filter(Boolean) as Array<{ id: string }>;

          if (!p.wait) {
            return this.result({
              batch: count,
              started: created.length,
              ids: created.map((c) => c.id),
              ...(errors.length ? { errors } : {}),
            });
          }

          const gens = await Promise.all(
            created.map((c) =>
              this.waitFor(userId, c.id, (p.max_wait_seconds ?? 240) * 1000),
            ),
          );
          return await this.mediaResultMany(gens, errors);
        } catch (error) {
          return this.errorResult(error);
        }
      },
    );

    // ── Text-to-video ─────────────────────────────────────────────────
    server.registerTool(
      'geraew_generate_video_from_text',
      {
        title: 'Generate Video from Text',
        description:
          'Generate a video from a text prompt (Veo). Video jobs take minutes; default wait=false — poll with geraew_get_generation.',
        inputSchema: {
          prompt: z.string().min(1),
          model: z
            .enum([
              'veo-3.1-generate-001',
              'veo-3.1-fast-generate-001',
              'geraew-fast',
              'geraew-quality',
            ])
            .default('veo-3.1-fast-generate-001'),
          resolution: z.enum(['720p', '1080p', '4k']).default('1080p'),
          duration_seconds: z.number().int().min(1).max(60).default(8),
          aspect_ratio: z.enum(['16:9', '9:16']).default('16:9'),
          generate_audio: z.boolean().default(true),
          negative_prompt: z.string().optional(),
          wait: z.boolean().default(false),
          max_wait_seconds: z.number().int().min(10).max(600).optional(),
        },
        annotations: { readOnlyHint: false, openWorldHint: true },
      },
      async (p) => {
        try {
          const dto = {
            prompt: p.prompt,
            model: p.model,
            resolution: VIDEO_RES[p.resolution],
            duration_seconds: p.duration_seconds,
            aspect_ratio: p.aspect_ratio,
            generate_audio: p.generate_audio,
            ...(p.negative_prompt ? { negative_prompt: p.negative_prompt } : {}),
          } as GenerateVideoTextToVideoDto;
          const created = await this.generations.generateTextToVideo(userId, dto);
          if (!p.wait) return this.result({ id: created.id, status: created.status });
          const gen = await this.waitFor(
            userId,
            created.id,
            (p.max_wait_seconds ?? 480) * 1000,
          );
          return await this.mediaResult(gen);
        } catch (error) {
          return this.errorResult(error);
        }
      },
    );

    // ── Image-to-video ────────────────────────────────────────────────
    server.registerTool(
      'geraew_generate_video_from_image',
      {
        title: 'Generate Video from Image',
        description:
          'Animate a still image (given by URL) into a video (Veo). Default wait=false — poll with geraew_get_generation.',
        inputSchema: {
          prompt: z.string().min(1),
          image_url: z.string().url().describe('Public URL of the starting image.'),
          model: z
            .enum([
              'veo-3.1-generate-001',
              'veo-3.1-fast-generate-001',
              'geraew-fast',
              'geraew-quality',
            ])
            .default('veo-3.1-fast-generate-001'),
          resolution: z.enum(['720p', '1080p', '4k']).default('1080p'),
          duration_seconds: z.number().int().min(1).max(60).default(8),
          generate_audio: z.boolean().default(true),
          negative_prompt: z.string().optional(),
          wait: z.boolean().default(false),
          max_wait_seconds: z.number().int().min(10).max(600).optional(),
        },
        annotations: { readOnlyHint: false, openWorldHint: true },
      },
      async (p) => {
        try {
          const { base64, mime } = await this.fetchToBase64(p.image_url);
          const dto = {
            prompt: p.prompt,
            model: p.model,
            resolution: VIDEO_RES[p.resolution],
            duration_seconds: p.duration_seconds,
            generate_audio: p.generate_audio,
            first_frame: base64,
            first_frame_mime_type: mime,
            ...(p.negative_prompt ? { negative_prompt: p.negative_prompt } : {}),
          } as GenerateVideoImageToVideoDto;
          const created = await this.generations.generateImageToVideo(userId, dto);
          if (!p.wait) return this.result({ id: created.id, status: created.status });
          const gen = await this.waitFor(
            userId,
            created.id,
            (p.max_wait_seconds ?? 480) * 1000,
          );
          return await this.mediaResult(gen);
        } catch (error) {
          return this.errorResult(error);
        }
      },
    );

    // ── Face swap ─────────────────────────────────────────────────────
    server.registerTool(
      'geraew_face_swap',
      {
        title: 'Face Swap',
        description:
          'Swap the face/subject from a source image onto a target scene image (both given by URL).',
        inputSchema: {
          source_image_url: z.string().url(),
          target_image_url: z.string().url(),
          resolution: z.enum(['1k', '2k', '4k']).default('2k'),
          ...waitControls,
        },
        annotations: { readOnlyHint: false, openWorldHint: true },
      },
      async (p) => {
        try {
          const source = await this.fetchToBase64(p.source_image_url);
          const target = await this.fetchToBase64(p.target_image_url);
          const dto = {
            source_image: source.base64,
            source_image_mime_type: source.mime,
            target_image: target.base64,
            target_image_mime_type: target.mime,
            resolution: p.resolution.toUpperCase(),
          } as unknown as GenerateFaceSwapDto;
          const created = await this.generations.generateFaceSwap(userId, dto);
          if (!p.wait) return this.result({ id: created.id, status: created.status });
          const gen = await this.waitFor(
            userId,
            created.id,
            (p.max_wait_seconds ?? 180) * 1000,
          );
          return await this.mediaResult(gen);
        } catch (error) {
          return this.errorResult(error);
        }
      },
    );

    // ── Get generation ────────────────────────────────────────────────
    server.registerTool(
      'geraew_get_generation',
      {
        title: 'Get Generation',
        description:
          'Fetch the status, details and output URLs of a generation by id.',
        inputSchema: { id: z.string() },
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
      },
      async (p) => {
        try {
          const gen = await this.generations.findById(userId, p.id);
          return await this.mediaResult(gen);
        } catch (error) {
          return this.errorResult(error);
        }
      },
    );

    // ── List generations ──────────────────────────────────────────────
    server.registerTool(
      'geraew_list_generations',
      {
        title: 'List Generations',
        description: "List the user's generations (gallery), most recent first.",
        inputSchema: {
          type: z.string().optional(),
          status: z
            .enum(['pending', 'processing', 'completed', 'failed'])
            .optional(),
          page: z.number().int().min(1).default(1),
          limit: z.number().int().min(1).max(100).default(20),
        },
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
      },
      async (p) => {
        try {
          const res: any = await this.generations.findAll(userId, p as any);
          const items = res.data ?? res.items ?? res;
          return this.result({
            count: Array.isArray(items) ? items.length : 0,
            meta: res.meta,
            generations: (Array.isArray(items) ? items : []).map((g: any) =>
              this.summarize(g),
            ),
          });
        } catch (error) {
          return this.errorResult(error);
        }
      },
    );

    // ── Credit balance ────────────────────────────────────────────────
    server.registerTool(
      'geraew_credit_balance',
      {
        title: 'Credit Balance',
        description: 'Get the current credit balance (plan + bonus) for the user.',
        inputSchema: {},
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
      },
      async () => {
        try {
          return this.result(await this.credits.getBalance(userId));
        } catch (error) {
          return this.errorResult(error);
        }
      },
    );
  }
}
