import { Injectable, Logger } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { Resolution, GenerationType } from '@prisma/client';
import { GenerationsService } from '../generations/generations.service';
import { CreditsService } from '../credits/credits.service';
import { McpConfig } from './mcp.config';
import { UploadSessionStore } from './upload-session.store';
import {
  UPLOAD_WIDGET_URI,
  UPLOAD_WIDGET_MIME,
  UPLOAD_WIDGET_HTML,
} from './upload-widget';
import type { GenerateImageDto } from '../generations/dto/generate-image.dto';
import type { GenerateVideoTextToVideoDto } from '../generations/dto/videos/generate-video-text-to-video.dto';
import type { GenerateVideoImageToVideoDto } from '../generations/dto/videos/generate-video-image-to-video.dto';
import type { GenerateFaceSwapDto } from '../generations/dto/generate-face-swap.dto';
import type { GenerateMotionControlDto } from '../generations/dto/videos/generate-motion-control.dto';
import type { UpscaleImageDto } from '../generations/dto/upscale-image.dto';
import type { GenerateVirtualTryOnDto } from '../generations/dto/generate-virtual-try-on.dto';
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

// Any resolution key (image or video) → Prisma Resolution. Used by the cost
// preflight tool, which spans both image and video operations.
const ALL_RES: Record<string, Resolution> = {
  '1k': Resolution.RES_1K,
  '2k': Resolution.RES_2K,
  '4k': Resolution.RES_4K,
  '720p': Resolution.RES_720P,
  '1080p': Resolution.RES_1080P,
};

// Friendly model name → cost variant (mirrors getModelVariant in the service).
// Only the models the cost table differentiates on need to appear here.
const MODEL_VARIANTS: Record<string, string> = {
  'Nano Banana 2': 'NB2',
  'Nano Banana Pro': 'NBP',
  'GPT Image 2': 'GPT_IMAGE_2',
  'Geraew Unlocked': 'SEM_CENSURA',
  'geraew-fast': 'GERAEW_FAST',
  'geraew-quality': 'GERAEW_QUALITY',
};

// Cost-preflight operation → the GenerationType its pricing is keyed on.
const ESTIMATE_TYPE: Record<string, GenerationType> = {
  image: GenerationType.TEXT_TO_IMAGE,
  video: GenerationType.TEXT_TO_VIDEO,
  motion_control: GenerationType.MOTION_CONTROL,
  face_swap: GenerationType.FACE_SWAP,
  upscale: GenerationType.TEXT_TO_IMAGE,
  virtual_try_on: GenerationType.VIRTUAL_TRY_ON,
};

const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

/** Minimal, non-generic view of McpServer to keep tsc cheap. */
interface RegisterableServer {
  registerTool(
    name: string,
    config: Record<string, unknown>,
    handler: (args: any) => Promise<unknown>,
  ): void;
  registerResource(
    name: string,
    uri: string,
    config: Record<string, unknown>,
    readCallback: () =>
      | { contents: Array<Record<string, unknown>> }
      | Promise<{ contents: Array<Record<string, unknown>> }>,
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
    private readonly config: McpConfig,
    private readonly uploadSessions: UploadSessionStore,
  ) {}

  build(userId: string): McpServer {
    // Advertise the MCP Apps UI extension so the host (claude.ai) enables
    // rendering of our `ui://` widget resource. Without the server declaring
    // this, hosts negotiate the capability one-sided and fail to load the app
    // ("Não foi possível acessar…"). Mirrors the client-side capability.
    const server = new McpServer(
      { name: 'geraew', version: '1.0.0' },
      {
        capabilities: {
          resources: {},
          extensions: {
            'io.modelcontextprotocol/ui': {
              mimeTypes: [UPLOAD_WIDGET_MIME],
            },
          },
        },
      },
    );
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
    // Keep the visible text minimal and URL-free so the assistant renders the
    // attached image(s) instead of listing links. Full URLs live in
    // structuredContent for machine use.
    const line =
      gen.status === 'COMPLETED'
        ? `✅ Pronto — ${gen.creditsConsumed ?? 0} créditos consumidos. Imagem anexada abaixo.`
        : gen.status === 'FAILED'
          ? `❌ Falhou: ${gen.errorMessage ?? 'erro desconhecido'}`
          : `⏳ Status: ${gen.status}`;
    const content: Array<Record<string, unknown>> = [
      { type: 'text', text: line },
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

    // URL-free summary line so the assistant shows the attached images instead
    // of dumping links. Details/URLs remain in structuredContent.
    const content: Array<Record<string, unknown>> = [
      {
        type: 'text',
        text: `✅ ${summary.completed}/${summary.requested} imagem(ns) pronta(s) — ${summary.total_credits} créditos no total. Imagens anexadas abaixo.${summary.failed ? ` (${summary.failed} falharam)` : ''}`,
      },
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
    // ── MCP Apps UI: inline in-chat upload widget ─────────────────────
    // Declared once per server. Hosts that negotiated `io.modelcontextprotocol/ui`
    // render this HTML in a sandboxed iframe when geraew_upload_image runs.
    server.registerResource(
      'geraew-upload-widget',
      UPLOAD_WIDGET_URI,
      {
        mimeType: UPLOAD_WIDGET_MIME,
        _meta: {
          ui: {
            csp: {
              // The iframe POSTs the image bytes to our /u/:token endpoint…
              connectDomains: [this.config.publicUrl],
              // …and results live on the CDN.
              resourceDomains: this.config.cdnUrl ? [this.config.cdnUrl] : [],
            },
            prefersBorder: true,
          },
        },
      },
      () => {
        // Diagnostic: proves the host actually fetched the UI resource. If this
        // never logs but the widget still errors, the host isn't negotiating
        // the UI extension; if it logs but the widget won't render, the issue
        // is client-side (CSP / iframe handshake).
        this.logger.log(`MCP Apps UI resource read: ${UPLOAD_WIDGET_URI}`);
        return {
          contents: [
            {
              uri: UPLOAD_WIDGET_URI,
              mimeType: UPLOAD_WIDGET_MIME,
              text: UPLOAD_WIDGET_HTML,
            },
          ],
        };
      },
    );

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
          'Generate one or more images from a text prompt, or edit/remix reference images when image_urls are provided. Set count>1 to generate several images IN PARALLEL from the same prompt (one batch, fired simultaneously) — use this instead of calling the tool repeatedly. Returns inline previews + CDN URLs. NOTE: image_urls must be PUBLIC URLs. If the user wants to use their OWN image (e.g. one they pasted/attached in the chat) as a reference, you cannot pass the attachment directly — first call geraew_upload_image to get a link for them to upload it, then use the returned URL here.',
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

    // ── Upload the user's own image (bring-your-own reference) ─────────
    server.registerTool(
      'geraew_upload_image',
      {
        title: 'Upload the user’s own image',
        description:
          "Let the USER upload their OWN image (e.g. one they pasted/attached in the chat) into GeraEW to use as a reference. You cannot forward a chat attachment directly to the generation tools — they only take public URLs — so call this whenever the user wants their own photo as a reference. On supported clients this renders an INLINE upload widget right in the chat: just tell the user to drop their image in the widget above. When they finish, a message with the public image_url is sent back automatically — pass that URL to geraew_generate_image (image_urls), geraew_face_swap, geraew_virtual_try_on, geraew_upscale_image or geraew_motion_control. If the widget does not appear, a fallback upload link is included in the text; the user opens it, uploads, then you call geraew_get_upload with the token to receive the URL. Valid for 15 minutes.",
        inputSchema: {},
        _meta: {
          ui: {
            resourceUri: UPLOAD_WIDGET_URI,
            visibility: ['model', 'app'],
          },
        },
        annotations: { readOnlyHint: false, openWorldHint: true },
      },
      async () => {
        try {
          const token = this.uploadSessions.create(userId);
          const uploadUrl = `${this.config.publicUrl}/u/${token}`;
          return {
            content: [
              {
                type: 'text' as const,
                text:
                  'Peça ao usuário para enviar a imagem no widget de upload acima. ' +
                  'Assim que ele terminar, você recebe a URL pública automaticamente. ' +
                  `(Se o widget não aparecer neste cliente, o usuário pode abrir este link e enviar por lá: ${uploadUrl} — depois chame geraew_get_upload com o token "${token}".)`,
              },
            ],
            structuredContent: {
              upload_url: uploadUrl,
              upload_endpoint: uploadUrl,
              token,
              status: 'pending',
              expires_in_seconds: 15 * 60,
            },
          };
        } catch (error) {
          return this.errorResult(error);
        }
      },
    );

    // ── Poll an upload session for the finished image ─────────────────
    server.registerTool(
      'geraew_get_upload',
      {
        title: 'Get uploaded image',
        description:
          'Check an upload session created by geraew_upload_image and return the public URL of the image the user uploaded. With wait=true (default) this blocks until the user finishes uploading (or the timeout). Pass the resulting image_url to geraew_generate_image (image_urls) or geraew_face_swap.',
        inputSchema: {
          token: z
            .string()
            .min(1)
            .describe('The token returned by geraew_upload_image.'),
          wait: z
            .boolean()
            .default(true)
            .describe('Wait until the user finishes uploading.'),
          max_wait_seconds: z
            .number()
            .int()
            .min(10)
            .max(600)
            .optional()
            .describe('Max seconds to wait when wait=true (default 300).'),
        },
        annotations: {
          readOnlyHint: true,
          idempotentHint: true,
          openWorldHint: true,
        },
      },
      async (p) => {
        try {
          const finished = (): {
            status: string;
            image_url?: string;
          } | null => {
            const s = this.uploadSessions.get(p.token);
            if (!s) return { status: 'expired' };
            if (s.status === 'completed' && s.imageUrl)
              return { status: 'completed', image_url: s.imageUrl };
            return null; // still pending
          };

          const immediate = finished();
          if (immediate) return this.result(immediate);

          if (p.wait === false) {
            return this.result({
              status: 'pending',
              message:
                'Ainda não recebi a imagem. Peça ao usuário para abrir o link e enviar.',
            });
          }

          const deadline = Date.now() + (p.max_wait_seconds ?? 300) * 1000;
          while (Date.now() < deadline) {
            await sleep(2500);
            const done = finished();
            if (done) return this.result(done);
          }
          return this.result({
            status: 'pending',
            message:
              'Tempo esgotado sem receber a imagem. Confirme com o usuário e chame geraew_get_upload de novo com o mesmo token.',
          });
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

    // ── Motion Control (image + reference video → video) ──────────────
    server.registerTool(
      'geraew_motion_control',
      {
        title: 'Motion Control',
        description:
          'Transfer the motion and camera movement of a REFERENCE VIDEO onto your character IMAGE (Kling 2.6). The persona in the image performs the exact movements/dance/gestures from the reference clip. Give image_url (the character/persona still) and video_url (the motion reference, mp4/mov/mkv). Both must be PUBLIC URLs — if the user wants their own photo/video, call geraew_upload_image first and use the returned URL. Video jobs take minutes; default wait=false — poll with geraew_get_generation.',
        inputSchema: {
          image_url: z
            .string()
            .url()
            .describe(
              'Public URL of the character/persona still image to animate.',
            ),
          video_url: z
            .string()
            .url()
            .describe(
              'Public URL of the reference motion video (mp4/mov/mkv).',
            ),
          resolution: z.enum(['720p', '1080p']).default('720p'),
          wait: z.boolean().default(false),
          max_wait_seconds: z.number().int().min(10).max(600).optional(),
        },
        annotations: { readOnlyHint: false, openWorldHint: true },
      },
      async (p) => {
        try {
          const img = await this.fetchToBase64(p.image_url);
          const vid = await this.fetchToBase64(p.video_url);
          const imageMime =
            img.mime === 'image/png'
              ? 'image/png'
              : img.mime === 'image/webp'
                ? 'image/webp'
                : 'image/jpeg';
          const videoMime =
            vid.mime === 'video/quicktime'
              ? 'video/quicktime'
              : vid.mime === 'video/x-matroska'
                ? 'video/x-matroska'
                : 'video/mp4';
          const dto = {
            image: img.base64,
            image_mime_type: imageMime,
            video: vid.base64,
            video_mime_type: videoMime,
            resolution: p.resolution,
          } as GenerateMotionControlDto;
          const created = await this.generations.generateMotionControl(
            userId,
            dto,
          );
          if (!p.wait)
            return this.result({ id: created.id, status: created.status });
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

    // ── Upscale image ─────────────────────────────────────────────────
    server.registerTool(
      'geraew_upscale_image',
      {
        title: 'Upscale Image',
        description:
          "Upscale and enhance an existing image to higher quality (2K) — sharper, cleaner, fewer compression artifacts — while preserving every detail, the exact composition, colors and content. Give image_url (a PUBLIC URL; for the user's own photo call geraew_upload_image first). Use this instead of re-generating when the user just wants a better-resolution version of an image they already have.",
        inputSchema: {
          image_url: z
            .string()
            .url()
            .describe('Public URL of the image to upscale.'),
          model: z
            .enum(['Nano Banana 2', 'Nano Banana Pro'])
            .default('Nano Banana Pro')
            .describe('Engine used for the enhancement pass.'),
          ...waitControls,
        },
        annotations: { readOnlyHint: false, openWorldHint: true },
      },
      async (p) => {
        try {
          const { base64, mime } = await this.fetchToBase64(p.image_url);
          const dto = {
            image: base64,
            mime_type: mime === 'image/png' ? 'image/png' : 'image/jpeg',
            model: IMAGE_MODEL_MAP[p.model] ?? 'gemini-3-pro-image-preview',
          } as UpscaleImageDto;
          const created = await this.generations.generateUpscale(userId, dto);
          if (!p.wait)
            return this.result({ id: created.id, status: created.status });
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

    // ── Virtual Try-On (dress a persona in a garment) ─────────────────
    server.registerTool(
      'geraew_virtual_try_on',
      {
        title: 'Virtual Try-On',
        description:
          "Dress an AI influencer/persona in a piece of clothing from a product photo — the influencer keeps their identity and pose while wearing the given outfit. Perfect for fashion content, TikTok Shop / product reviews and UGC. Give influencer_image_url (the persona) and clothing_image_url (the garment/product photo). Both must be PUBLIC URLs — for the user's own photos call geraew_upload_image first.",
        inputSchema: {
          influencer_image_url: z
            .string()
            .url()
            .describe('Public URL of the AI influencer/persona photo.'),
          clothing_image_url: z
            .string()
            .url()
            .describe('Public URL of the clothing/product photo.'),
          additional_instructions: z
            .string()
            .optional()
            .describe('Extra guidance, e.g. "outdoor setting, natural light".'),
          model: z
            .enum(['Nano Banana 2', 'Nano Banana Pro'])
            .default('Nano Banana 2'),
          aspect_ratio: z
            .enum(['1:1', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9'])
            .default('3:4'),
          resolution: z.enum(['1k', '2k', '4k']).default('2k'),
          ...waitControls,
        },
        annotations: { readOnlyHint: false, openWorldHint: true },
      },
      async (p) => {
        try {
          const inf = await this.fetchToBase64(p.influencer_image_url);
          const clo = await this.fetchToBase64(p.clothing_image_url);
          const mimeOf = (m: string): string =>
            m === 'image/png'
              ? 'image/png'
              : m === 'image/webp'
                ? 'image/webp'
                : 'image/jpeg';
          const dto = {
            influencer_image: inf.base64,
            influencer_image_mime_type: mimeOf(inf.mime),
            clothing_image: clo.base64,
            clothing_image_mime_type: mimeOf(clo.mime),
            ...(p.additional_instructions
              ? { additional_instructions: p.additional_instructions }
              : {}),
            model: IMAGE_MODEL_MAP[p.model] ?? 'gemini-3.1-flash-image-preview',
            resolution: IMAGE_RES[p.resolution],
            aspect_ratio: p.aspect_ratio,
          } as GenerateVirtualTryOnDto;
          const created = await this.generations.generateVirtualTryOn(
            userId,
            dto,
          );
          if (!p.wait)
            return this.result({ id: created.id, status: created.status });
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

    // ── Estimate cost (preflight, spends nothing) ─────────────────────
    server.registerTool(
      'geraew_estimate_cost',
      {
        title: 'Estimate Credit Cost',
        description:
          'Preflight the credit cost of a generation BEFORE running it — a price check. Returns how many credits the operation would cost, whether the user has enough balance, and whether a free generation applies. Call this when the user asks "how much does X cost?", or before an expensive video / large batch so they can confirm. This generates NOTHING and consumes NO credits.',
        inputSchema: {
          operation: z
            .enum([
              'image',
              'video',
              'motion_control',
              'face_swap',
              'upscale',
              'virtual_try_on',
            ])
            .describe('Which kind of generation you want to price.'),
          resolution: z
            .enum(['1k', '2k', '4k', '720p', '1080p'])
            .default('2k')
            .describe('Use 1k/2k/4k for images, 720p/1080p/4k for videos.'),
          model: z
            .enum([
              'Nano Banana 2',
              'Nano Banana Pro',
              'GPT Image 2',
              'Geraew Unlocked',
              'geraew-fast',
              'geraew-quality',
            ])
            .optional()
            .describe(
              'Model whose pricing to use (affects image and video cost).',
            ),
          duration_seconds: z
            .number()
            .int()
            .min(1)
            .max(60)
            .optional()
            .describe('For video / motion_control.'),
          generate_audio: z
            .boolean()
            .default(false)
            .describe('For video: audio increases the cost.'),
          count: z
            .number()
            .int()
            .min(1)
            .max(8)
            .default(1)
            .describe('Number of samples (cost scales linearly).'),
        },
        annotations: {
          readOnlyHint: true,
          idempotentHint: true,
          openWorldHint: true,
        },
      },
      async (p) => {
        try {
          const est = await this.credits.estimateCost(
            userId,
            ESTIMATE_TYPE[p.operation],
            ALL_RES[p.resolution],
            p.duration_seconds,
            p.generate_audio,
            p.count ?? 1,
            p.model ? MODEL_VARIANTS[p.model] : undefined,
          );
          return this.result(est);
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
