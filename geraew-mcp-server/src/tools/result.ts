/**
 * Formats a value (or an error) into an MCP tool response.
 */
import { CHARACTER_LIMIT } from "../constants.js";
import { GeraewApiError } from "../services/client.js";

export function toolResult(value: unknown, isError = false) {
  if (isError) {
    return {
      content: [{ type: "text" as const, text: formatError(value) }],
      isError: true,
    };
  }

  const structured =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : { data: value };

  let text = JSON.stringify(value, null, 2);
  if (text.length > CHARACTER_LIMIT) {
    text = text.slice(0, CHARACTER_LIMIT) + "\n… (truncated)";
  }

  return {
    content: [{ type: "text" as const, text }],
    structuredContent: structured,
  };
}

function formatError(error: unknown): string {
  if (error instanceof GeraewApiError) {
    const parts = [`Error: ${error.message}`];
    if (error.code) parts.push(`(code: ${error.code})`);
    if (error.status) parts.push(`[HTTP ${error.status}]`);
    if (error.status === 402 || error.code === "INSUFFICIENT_CREDITS") {
      parts.push("— check your balance with geraew_credit_balance.");
    }
    return parts.join(" ");
  }
  return `Error: ${error instanceof Error ? error.message : String(error)}`;
}
