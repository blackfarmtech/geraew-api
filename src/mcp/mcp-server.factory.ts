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
          'Generate an image from a text prompt, or edit/remix reference images when image_urls are provided. Returns CDN URLs of the result.',
        inputSchema: {
          prompt: z.string().min(1),
          model: z
            .enum([
              'gemini-3-pro-image-preview',
              'gemini-3.1-flash-image-preview',
              'sem-censura',
              'gpt-image-2',
              'seedream-5-lite',
            ])
            .default('gemini-3.1-flash-image-preview'),
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
          const dto = {
            prompt: p.prompt,
            model: p.model,
            resolution: IMAGE_RES[p.resolution],
            ...(p.aspect_ratio ? { aspect_ratio: p.aspect_ratio } : {}),
            ...(images ? { images } : {}),
          } as GenerateImageDto;
          const created = await this.generations.generateImage(userId, dto);
          if (!p.wait) return this.result({ id: created.id, status: created.status });
          const gen = await this.waitFor(
            userId,
            created.id,
            (p.max_wait_seconds ?? 180) * 1000,
          );
          return this.result(this.summarize(gen));
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
          return this.result(this.summarize(gen));
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
          return this.result(this.summarize(gen));
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
          return this.result(this.summarize(gen));
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
          return this.result(this.summarize(gen));
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
