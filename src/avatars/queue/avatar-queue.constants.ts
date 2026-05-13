export const AVATAR_QUEUE = 'avatar';

export enum AvatarJobName {
  SUBMIT_TRAINING = 'submit-training',
  GENERATE_VIDEO = 'generate-video',
}

export interface SubmitTrainingJobData {
  userAvatarId: string;
  /** Determines which HeyGen endpoint to call. Defaults to 'photo' for backwards compat. */
  avatarType?: 'photo' | 'digital_twin';
}

/**
 * Generates a video using a trained avatar. The Generation row is created
 * by AvatarsService BEFORE enqueueing — the worker only drives the HeyGen
 * call + polling + output persistence + status update.
 */
export interface GenerateVideoJobData {
  userAvatarId: string;
  generationId: string;
  userId: string;
  creditsConsumed: number;
}

export type AvatarJobData = SubmitTrainingJobData | GenerateVideoJobData;

/** How long a single HeyGen video render is allowed to run before we give up. */
export const AVATAR_VIDEO_JOB_TIMEOUT_MS = 12 * 60 * 1000; // 12 min

/** Polling interval / max attempts for /v3/videos/{id} status (worker fallback). */
export const AVATAR_VIDEO_POLL_INTERVAL_MS = 5_000;
export const AVATAR_VIDEO_POLL_MAX_ATTEMPTS = 144; // 12 min @ 5s
