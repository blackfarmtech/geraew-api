/**
 * Read-only / utility tools: fetch a generation, list history, check credit
 * balance, and re-download an existing generation's outputs.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GeraewClient } from "../services/client.js";
import {
  Generation,
  finalizeGeneration,
  pollUntilDone,
} from "../services/generation.js";
import { toolResult } from "./result.js";

export function registerAccountTools(
  server: McpServer,
  client: GeraewClient,
): void {
  // ── Get / poll a generation ────────────────────────────────────────────
  server.registerTool(
    "geraew_get_generation",
    {
      title: "Get Generation",
      description: `Fetch the status and details of a generation by id. Use this to poll jobs created with wait=false, or to re-download a finished generation's outputs.

Args:
  - id (string): Generation id.
  - wait (bool, default false): If true, block until the job reaches a terminal state.
  - download (bool, default true): When the generation is COMPLETED, download outputs to disk.
  - download_dir (optional): Where to save outputs.
  - max_wait_seconds (optional): Max seconds to wait when wait=true (default 480).`,
      inputSchema: {
        id: z.string().describe("Generation id."),
        wait: z.boolean().default(false),
        download: z.boolean().default(true),
        download_dir: z.string().optional(),
        max_wait_seconds: z.number().int().min(10).max(1800).optional(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (p) => {
      try {
        let gen: Generation | null;
        if (p.wait) {
          gen = await pollUntilDone(
            client,
            p.id,
            (p.max_wait_seconds ?? 480) * 1000,
          );
          if (!gen) {
            return toolResult({
              id: p.id,
              status: "PROCESSING",
              timed_out: true,
              message: "Still processing after the wait window.",
            });
          }
        } else {
          gen = await client.request<Generation>("GET", `/generations/${p.id}`);
        }

        if (p.download && gen.status === "COMPLETED") {
          return toolResult(await finalizeGeneration(gen, p.download_dir));
        }
        return toolResult({
          id: gen.id,
          type: gen.type,
          status: gen.status,
          model_used: gen.modelUsed,
          resolution: gen.resolution,
          credits_consumed: gen.creditsConsumed,
          error_message: gen.errorMessage,
          error_code: gen.errorCode,
          output_count: gen.outputs?.length ?? 0,
          urls: gen.outputs?.map((o) => o.url) ?? [],
        });
      } catch (error) {
        return toolResult(error, true);
      }
    },
  );

  // ── List generations ───────────────────────────────────────────────────
  server.registerTool(
    "geraew_list_generations",
    {
      title: "List Generations",
      description: `List the user's generations (gallery), most recent first. Supports filtering by type/status and pagination.

Args:
  - type (optional): text_to_image | image_to_image | text_to_video | image_to_video | motion_control | face_swap | virtual_try_on | ...
  - status (optional): pending | processing | completed | failed
  - favorited (optional bool)
  - page (int, default 1), limit (int, default 20, max 100).`,
      inputSchema: {
        type: z.string().optional(),
        status: z
          .enum(["pending", "processing", "completed", "failed"])
          .optional(),
        favorited: z.boolean().optional(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(20),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (p) => {
      try {
        const params: Record<string, unknown> = {
          page: p.page,
          limit: p.limit,
        };
        if (p.type) params.type = p.type;
        if (p.status) params.status = p.status;
        if (p.favorited !== undefined) params.favorited = p.favorited;

        const res = await client.request<any>(
          "GET",
          "/generations",
          undefined,
          params,
        );
        const items = Array.isArray(res) ? res : (res.data ?? res.items ?? []);
        const meta = res.meta;

        return toolResult({
          count: items.length,
          meta,
          generations: items.map((g: Generation) => ({
            id: g.id,
            type: g.type,
            status: g.status,
            prompt: g.prompt,
            model_used: g.modelUsed,
            credits_consumed: g.creditsConsumed,
            created_at: g.createdAt,
            urls: g.outputs?.map((o) => o.url) ?? [],
          })),
        });
      } catch (error) {
        return toolResult(error, true);
      }
    },
  );

  // ── Credit balance ─────────────────────────────────────────────────────
  server.registerTool(
    "geraew_credit_balance",
    {
      title: "Credit Balance",
      description:
        "Get the current credit balance (plan credits + bonus credits) for the authenticated user.",
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async () => {
      try {
        const balance = await client.request("GET", "/credits/balance");
        return toolResult(balance);
      } catch (error) {
        return toolResult(error, true);
      }
    },
  );
}
