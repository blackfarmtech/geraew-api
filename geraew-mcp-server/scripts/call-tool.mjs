// Minimal MCP stdio driver: handshake, call one tool, print the result.
// Usage: node scripts/call-tool.mjs <toolName> '<jsonArgs>'
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(__dirname, "..", "dist", "index.js");
const toolName = process.argv[2];
const toolArgs = JSON.parse(process.argv[3] ?? "{}");

const child = spawn("node", [serverPath], {
  stdio: ["pipe", "pipe", "inherit"],
  env: process.env,
});

let buf = "";
const pending = new Map();
child.stdout.on("data", (d) => {
  buf += d;
  let idx;
  while ((idx = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});

const send = (obj) => child.stdin.write(JSON.stringify(obj) + "\n");
const rpc = (id, method, params) =>
  new Promise((resolve) => { pending.set(id, resolve); send({ jsonrpc: "2.0", id, method, params }); });

const run = async () => {
  await rpc(1, "initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "driver", version: "1.0" },
  });
  send({ jsonrpc: "2.0", method: "notifications/initialized" });
  const res = await rpc(2, "tools/call", { name: toolName, arguments: toolArgs });
  const text = res.result?.content?.[0]?.text ?? JSON.stringify(res, null, 2);
  console.log(text);
  if (res.result?.isError) process.exitCode = 1;
  child.kill();
};

run().catch((e) => { console.error(e); child.kill(); process.exit(1); });
