/**
 * Shared Zod fragments reused across generation tools.
 */
import { z } from "zod";

/** Common `wait` / `download_dir` controls for generation tools. */
export const waitControls = {
  wait: z
    .boolean()
    .default(true)
    .describe(
      "If true (default), block until the generation finishes and download the outputs locally. If false, return immediately with the generation id.",
    ),
  download_dir: z
    .string()
    .optional()
    .describe(
      "Directory to save downloaded outputs into. Defaults to GERAEW_DOWNLOAD_DIR or the current working directory.",
    ),
  max_wait_seconds: z
    .number()
    .int()
    .min(10)
    .max(1800)
    .optional()
    .describe("Maximum seconds to wait when wait=true (default 480)."),
};

/** Friendly resolution aliases accepted by the image/video tools. */
export const IMAGE_RESOLUTION = z
  .enum(["1k", "2k", "4k"])
  .describe("Output resolution.");

export const VIDEO_RESOLUTION = z
  .enum(["720p", "1080p", "4k"])
  .describe("Output resolution.");

export const IMAGE_ASPECT_RATIO = z
  .enum(["1:1", "3:2", "2:3", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"])
  .describe("Aspect ratio of the generated image.");

export const VIDEO_ASPECT_RATIO = z
  .enum(["16:9", "9:16"])
  .describe("Aspect ratio of the generated video.");
