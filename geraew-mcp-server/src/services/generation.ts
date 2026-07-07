/**
 * High-level generation workflow: submit a job, optionally wait for it to
 * finish, and download the outputs locally.
 */
import {
  DEFAULT_DOWNLOAD_DIR,
  DEFAULT_MAX_WAIT_MS,
  POLL_INTERVAL_MS,
} from "../constants.js";
import { GeraewClient } from "./client.js";
import { downloadOutputs } from "./media.js";

export interface GenerationOutput {
  id: string;
  url: string;
  thumbnailUrl?: string;
  mimeType?: string;
  order: number;
}

export interface Generation {
  id: string;
  type: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | string;
  prompt?: string;
  resolution?: string;
  modelUsed?: string;
  outputs: GenerationOutput[];
  hasWatermark?: boolean;
  creditsConsumed?: number;
  errorMessage?: string;
  errorCode?: string;
  createdAt?: string;
  completedAt?: string;
}

export interface CreateGenerationResponse {
  id: string;
  status: string;
  creditsConsumed: number;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const isTerminal = (status: string): boolean =>
  status === "COMPLETED" || status === "FAILED";

/**
 * Runs a full generation: POST the job, and — when `wait` is true — poll until
 * terminal, then download outputs. Returns a normalized result object suitable
 * for a tool response.
 */
export async function runGeneration(
  client: GeraewClient,
  endpoint: string,
  body: unknown,
  opts: { wait: boolean; downloadDir?: string; maxWaitMs?: number },
): Promise<Record<string, unknown>> {
  const created = await client.request<CreateGenerationResponse>(
    "POST",
    `/generations/${endpoint}`,
    body,
  );

  if (!opts.wait) {
    return {
      id: created.id,
      status: created.status,
      credits_consumed: created.creditsConsumed,
      message:
        "Generation submitted. Poll with geraew_get_generation to track status and fetch outputs.",
    };
  }

  const final = await pollUntilDone(
    client,
    created.id,
    opts.maxWaitMs ?? DEFAULT_MAX_WAIT_MS,
  );

  if (!final) {
    return {
      id: created.id,
      status: "PROCESSING",
      credits_consumed: created.creditsConsumed,
      timed_out: true,
      message:
        "Still processing after the wait window. Poll with geraew_get_generation using this id.",
    };
  }

  return finalizeGeneration(final, opts.downloadDir);
}

/** Polls a generation id until it reaches a terminal state or times out. */
export async function pollUntilDone(
  client: GeraewClient,
  id: string,
  maxWaitMs: number,
): Promise<Generation | null> {
  const deadline = Date.now() + maxWaitMs;
  // First read immediately, then poll on an interval.
  let gen = await client.request<Generation>("GET", `/generations/${id}`);
  while (!isTerminal(gen.status)) {
    if (Date.now() >= deadline) return null;
    await sleep(POLL_INTERVAL_MS);
    gen = await client.request<Generation>("GET", `/generations/${id}`);
  }
  return gen;
}

/**
 * Turns a terminal generation into a tool result, downloading outputs to disk
 * when it completed successfully.
 */
export async function finalizeGeneration(
  gen: Generation,
  downloadDir?: string,
): Promise<Record<string, unknown>> {
  if (gen.status === "FAILED") {
    return {
      id: gen.id,
      status: gen.status,
      error_code: gen.errorCode,
      error_message: gen.errorMessage ?? "Generation failed.",
      note: "Credits are automatically refunded for failed generations.",
    };
  }

  const dir = downloadDir ?? DEFAULT_DOWNLOAD_DIR;
  let files: Array<{ path: string; url: string }> = [];
  if (gen.outputs?.length) {
    files = await downloadOutputs(gen.outputs, dir, `geraew-${gen.id}`);
  }

  return {
    id: gen.id,
    status: gen.status,
    type: gen.type,
    model_used: gen.modelUsed,
    resolution: gen.resolution,
    credits_consumed: gen.creditsConsumed,
    has_watermark: gen.hasWatermark,
    output_count: gen.outputs?.length ?? 0,
    files: files.map((f) => f.path),
    urls: gen.outputs?.map((o) => o.url) ?? [],
    download_dir: gen.outputs?.length ? dir : undefined,
  };
}
