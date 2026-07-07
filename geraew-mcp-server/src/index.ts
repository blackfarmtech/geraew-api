#!/usr/bin/env node
/**
 * GeraEW MCP server — lets Claude Code generate images and videos through the
 * GeraEW AI API. Communicates over stdio.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { GeraewClient } from "./services/client.js";
import { registerGenerationTools } from "./tools/generations.js";
import { registerAccountTools } from "./tools/account.js";

async function main(): Promise<void> {
  const server = new McpServer({
    name: "geraew-mcp-server",
    version: "1.0.0",
  });

  if (!GeraewClient.hasCredentials()) {
    // Don't crash — surface the misconfiguration on stderr so the client logs it.
    console.error(
      "[geraew-mcp-server] Warning: no credentials configured. " +
        "Set GERAEW_EMAIL + GERAEW_PASSWORD (or GERAEW_ACCESS_TOKEN) in the server env.",
    );
  }

  const client = new GeraewClient();
  registerGenerationTools(server, client);
  registerAccountTools(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[geraew-mcp-server] running on stdio");
}

main().catch((error) => {
  console.error("[geraew-mcp-server] fatal:", error);
  process.exit(1);
});
