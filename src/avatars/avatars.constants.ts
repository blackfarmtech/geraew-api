/**
 * Default training cost in credits — overridable via AVATAR_TRAINING_CREDITS.
 * Avatar V/IV training in HeyGen self-serve is ~$1.00 per call (≈ R$5,67 a 5,67/USD).
 */
export const DEFAULT_AVATAR_TRAINING_CREDITS = 5000;

/**
 * Hard timeout (minutes) for an avatar in TRAINING/PENDING_CONSENT before the
 * cron marks it FAILED and refunds. Should comfortably exceed HeyGen's typical SLA.
 */
export const DEFAULT_AVATAR_TRAINING_TIMEOUT_MIN = 90;

/**
 * Min/max source video duration accepted at upload time.
 * HeyGen accepts footage between 15s and 10min; we use 20s-5min as our window.
 */
export const AVATAR_SOURCE_MIN_DURATION_S = 20;
export const AVATAR_SOURCE_MAX_DURATION_S = 300;

/**
 * Max source video size (bytes). HeyGen accepts larger but we cap to keep
 * upload fast and reduce R2 cost.
 */
export const AVATAR_SOURCE_MAX_BYTES = 500 * 1024 * 1024; // 500 MB

/**
 * Per-render credit costs for avatar→video. Hard-coded for now; user said
 * pricing decision comes later. Numbers are a placeholder estimate based on
 * HeyGen self-serve ($0.0667/sec for 1080p Avatar IV) at R$5,67/USD with ~40% margin.
 *
 * Cost lookup: AVATAR_VIDEO_CREDIT_COSTS[resolution][engine]
 * Rough scale: 1080p / avatar_iv — 30s video ~= 1500 credits.
 */
export const AVATAR_VIDEO_CREDIT_COSTS: Record<string, Record<string, number>> = {
  '720p': { avatar_iv: 1200, avatar_v: 1800 },
  '1080p': { avatar_iv: 1500, avatar_v: 2200 },
  '4k': { avatar_iv: 2400, avatar_v: 3600 },
};
