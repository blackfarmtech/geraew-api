/**
 * Shared constants for the GeraEW MCP server.
 */

/** Base URL of the GeraEW API (no trailing slash). Overridable via env. */
export const BASE_URL = (
  process.env.GERAEW_BASE_URL ?? "http://localhost:3000"
).replace(/\/+$/, "");

/** All GeraEW routes are mounted under this prefix. */
export const API_PREFIX = "/api/v1";

/** Credentials / token env vars. */
export const ENV = {
  email: process.env.GERAEW_EMAIL,
  password: process.env.GERAEW_PASSWORD,
  accessToken: process.env.GERAEW_ACCESS_TOKEN,
  refreshToken: process.env.GERAEW_REFRESH_TOKEN,
};

/** Where downloaded outputs are written when the caller doesn't specify. */
export const DEFAULT_DOWNLOAD_DIR =
  process.env.GERAEW_DOWNLOAD_DIR ?? process.cwd();

/** Polling configuration for `wait`-style tools. */
export const POLL_INTERVAL_MS = 3000;
/** Default max time to wait for a generation to finish (ms). */
export const DEFAULT_MAX_WAIT_MS = 8 * 60 * 1000; // 8 minutes

/** Max characters for a single tool text response. */
export const CHARACTER_LIMIT = 25000;

/**
 * Maps friendly resolution aliases to the Prisma `Resolution` enum values used
 * by the image / video generation endpoints.
 */
export const RESOLUTION_ENUM: Record<string, string> = {
  "480p": "RES_480P",
  "720p": "RES_720P",
  "1080p": "RES_1080P",
  "1k": "RES_1K",
  "2k": "RES_2K",
  "3k": "RES_3K",
  "4k": "RES_4K",
};

/** Known models per capability (for descriptions / defaults). */
export const IMAGE_MODELS = [
  "gemini-3-pro-image-preview",
  "gemini-3.1-flash-image-preview",
  "sem-censura",
  "gpt-image-2",
  "seedream-5-lite",
] as const;

export const VIDEO_MODELS = [
  "veo-3.1-generate-001",
  "veo-3.1-fast-generate-001",
  "geraew-fast",
  "geraew-quality",
] as const;
