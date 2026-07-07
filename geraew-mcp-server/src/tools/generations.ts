/**
 * Generation tools: image, text-to-video, image-to-video, face-swap,
 * motion-control. Each accepts local file paths for inputs and (by default)
 * downloads the finished outputs to disk.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GeraewClient } from "../services/client.js";
import { fileToBase64 } from "../services/media.js";
import { runGeneration } from "../services/generation.js";
import { toolResult } from "./result.js";
import {
  IMAGE_ASPECT_RATIO,
  IMAGE_RESOLUTION,
  VIDEO_ASPECT_RATIO,
  VIDEO_RESOLUTION,
  waitControls,
} from "../schemas.js";
import { IMAGE_MODELS, RESOLUTION_ENUM, VIDEO_MODELS } from "../constants.js";

function waitOpts(p: {
  wait: boolean;
  download_dir?: string;
  max_wait_seconds?: number;
}) {
  return {
    wait: p.wait,
    downloadDir: p.download_dir,
    maxWaitMs: p.max_wait_seconds ? p.max_wait_seconds * 1000 : undefined,
  };
}

export function registerGenerationTools(
  server: McpServer,
  client: GeraewClient,
): void {
  // ── Image (text-to-image / image-to-image) ─────────────────────────────
  server.registerTool(
    "geraew_generate_image",
    {
      title: "Generate Image",
      description: `Generate an image from a text prompt (text-to-image), or edit/remix one or more reference images (image-to-image) when input_images are provided.

Args:
  - prompt (string): What to generate.
  - model (enum): One of ${IMAGE_MODELS.join(", ")}. Default gemini-3.1-flash-image-preview.
  - resolution ('1k'|'2k'|'4k'): Output resolution. Default 2k.
  - aspect_ratio (optional): e.g. '1:1', '9:16', '16:9'.
  - input_images (optional string[]): Local file paths to use as reference/edit inputs. Presence switches to image-to-image.
  - wait (bool, default true): Wait for completion and download the result.
  - download_dir (optional): Where to save outputs.

Returns generation id, status, credits_consumed, and — when wait=true — local file paths of the downloaded image(s).`,
      inputSchema: {
        prompt: z.string().min(1).describe("Text prompt describing the image."),
        model: z
          .enum(IMAGE_MODELS)
          .default("gemini-3.1-flash-image-preview")
          .describe("Image model to use."),
        resolution: IMAGE_RESOLUTION.default("2k"),
        aspect_ratio: IMAGE_ASPECT_RATIO.optional(),
        input_images: z
          .array(z.string())
          .max(6)
          .optional()
          .describe("Local file paths of reference images (image-to-image)."),
        ...waitControls,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (p) => {
      try {
        const images = p.input_images
          ? await Promise.all(
              p.input_images.map(async (fp) => {
                const { base64, mimeType } = await fileToBase64(fp);
                return {
                  base64,
                  mime_type: mimeType === "image/jpeg" ? "image/jpeg" : "image/png",
                };
              }),
            )
          : undefined;

        const body: Record<string, unknown> = {
          prompt: p.prompt,
          model: p.model,
          resolution: RESOLUTION_ENUM[p.resolution],
          ...(p.aspect_ratio ? { aspect_ratio: p.aspect_ratio } : {}),
          ...(images ? { images } : {}),
        };

        const result = await runGeneration(
          client,
          "generate-image",
          body,
          waitOpts(p),
        );
        return toolResult(result);
      } catch (error) {
        return toolResult(error, true);
      }
    },
  );

  // ── Text-to-video ──────────────────────────────────────────────────────
  server.registerTool(
    "geraew_generate_video_from_text",
    {
      title: "Generate Video from Text",
      description: `Generate a video from a text prompt using Veo.

Args:
  - prompt (string): Scene description.
  - model (enum): ${VIDEO_MODELS.join(", ")}. Default veo-3.1-fast-generate-001.
  - resolution ('720p'|'1080p'|'4k'): Default 1080p.
  - duration_seconds (int, default 8).
  - aspect_ratio ('16:9'|'9:16', default 16:9).
  - generate_audio (bool, default true).
  - negative_prompt (optional): what to avoid.
  - wait / download_dir as usual.

Note: video generation takes longer — raise max_wait_seconds for large jobs, or set wait=false and poll with geraew_get_generation.`,
      inputSchema: {
        prompt: z.string().min(1),
        model: z
          .enum(VIDEO_MODELS)
          .default("veo-3.1-fast-generate-001"),
        resolution: VIDEO_RESOLUTION.default("1080p"),
        duration_seconds: z.number().int().min(1).max(60).default(8),
        aspect_ratio: VIDEO_ASPECT_RATIO.default("16:9"),
        generate_audio: z.boolean().default(true),
        negative_prompt: z.string().optional(),
        ...waitControls,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (p) => {
      try {
        const body: Record<string, unknown> = {
          prompt: p.prompt,
          model: p.model,
          resolution: RESOLUTION_ENUM[p.resolution],
          duration_seconds: p.duration_seconds,
          aspect_ratio: p.aspect_ratio,
          generate_audio: p.generate_audio,
          ...(p.negative_prompt ? { negative_prompt: p.negative_prompt } : {}),
        };
        const result = await runGeneration(
          client,
          "text-to-video",
          body,
          waitOpts(p),
        );
        return toolResult(result);
      } catch (error) {
        return toolResult(error, true);
      }
    },
  );

  // ── Image-to-video ─────────────────────────────────────────────────────
  server.registerTool(
    "geraew_generate_video_from_image",
    {
      title: "Generate Video from Image",
      description: `Animate a still image into a video (image-to-video) using Veo. The first frame is a local image file; optionally provide a last frame to control the ending.

Args:
  - prompt (string): How the image should move / the scene.
  - first_frame_path (string): Local path to the starting image.
  - last_frame_path (optional string): Local path to an ending image.
  - model (enum): ${VIDEO_MODELS.join(", ")}. Default veo-3.1-fast-generate-001.
  - resolution ('720p'|'1080p'|'4k'): Default 1080p.
  - duration_seconds (int, default 8).
  - generate_audio (bool, default true).
  - negative_prompt (optional).
  - wait / download_dir as usual.`,
      inputSchema: {
        prompt: z.string().min(1),
        first_frame_path: z
          .string()
          .describe("Local path to the starting/first-frame image."),
        last_frame_path: z
          .string()
          .optional()
          .describe("Local path to an optional ending/last-frame image."),
        model: z
          .enum(VIDEO_MODELS)
          .default("veo-3.1-fast-generate-001"),
        resolution: VIDEO_RESOLUTION.default("1080p"),
        duration_seconds: z.number().int().min(1).max(60).default(8),
        generate_audio: z.boolean().default(true),
        negative_prompt: z.string().optional(),
        ...waitControls,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (p) => {
      try {
        const first = await fileToBase64(p.first_frame_path);
        const last = p.last_frame_path
          ? await fileToBase64(p.last_frame_path)
          : undefined;
        const body: Record<string, unknown> = {
          prompt: p.prompt,
          model: p.model,
          resolution: RESOLUTION_ENUM[p.resolution],
          duration_seconds: p.duration_seconds,
          generate_audio: p.generate_audio,
          first_frame: first.base64,
          first_frame_mime_type: first.mimeType,
          ...(last
            ? { last_frame: last.base64, last_frame_mime_type: last.mimeType }
            : {}),
          ...(p.negative_prompt ? { negative_prompt: p.negative_prompt } : {}),
        };
        const result = await runGeneration(
          client,
          "image-to-video",
          body,
          waitOpts(p),
        );
        return toolResult(result);
      } catch (error) {
        return toolResult(error, true);
      }
    },
  );

  // ── Face swap ──────────────────────────────────────────────────────────
  server.registerTool(
    "geraew_face_swap",
    {
      title: "Face Swap",
      description: `Swap the face/subject from a source image onto a target scene image.

Args:
  - source_image_path (string): Local path to the face/subject to insert.
  - target_image_path (string): Local path to the scene image to receive the face.
  - resolution ('1k'|'2k'|'4k', default 2k).
  - wait / download_dir as usual.`,
      inputSchema: {
        source_image_path: z.string().describe("Local path to the source face image."),
        target_image_path: z.string().describe("Local path to the target scene image."),
        resolution: z.enum(["1k", "2k", "4k"]).default("2k"),
        ...waitControls,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (p) => {
      try {
        const source = await fileToBase64(p.source_image_path);
        const target = await fileToBase64(p.target_image_path);
        const body: Record<string, unknown> = {
          source_image: source.base64,
          source_image_mime_type: source.mimeType,
          target_image: target.base64,
          target_image_mime_type: target.mimeType,
          resolution: p.resolution.toUpperCase(), // API expects '1K' | '2K' | '4K'
        };
        const result = await runGeneration(
          client,
          "face-swap",
          body,
          waitOpts(p),
        );
        return toolResult(result);
      } catch (error) {
        return toolResult(error, true);
      }
    },
  );

  // ── Motion control (Wan Animate Replace) ───────────────────────────────
  server.registerTool(
    "geraew_motion_control",
    {
      title: "Motion Control",
      description: `Replace the subject in a reference video with a still image, transferring the video's motion onto the new subject (Wan Animate Replace).

Args:
  - reference_video_path (string): Local path to the reference video (mp4/mov/mkv).
  - image_path (string): Local path to the replacement subject image.
  - resolution ('720p'|'1080p', default 720p).
  - wait / download_dir as usual.`,
      inputSchema: {
        reference_video_path: z
          .string()
          .describe("Local path to the reference video providing the motion."),
        image_path: z
          .string()
          .describe("Local path to the replacement subject image."),
        resolution: z.enum(["720p", "1080p"]).default("720p"),
        ...waitControls,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (p) => {
      try {
        const video = await fileToBase64(p.reference_video_path);
        const image = await fileToBase64(p.image_path);
        const body: Record<string, unknown> = {
          video: video.base64,
          video_mime_type: video.mimeType.startsWith("video/")
            ? video.mimeType
            : "video/mp4",
          image: image.base64,
          image_mime_type: image.mimeType,
          resolution: p.resolution, // API expects '720p' | '1080p'
        };
        const result = await runGeneration(
          client,
          "motion-control",
          body,
          waitOpts(p),
        );
        return toolResult(result);
      } catch (error) {
        return toolResult(error, true);
      }
    },
  );
}
