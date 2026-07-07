/**
 * Local-file helpers: read an input file into base64 and download output URLs
 * to disk so Claude Code can reference the results directly.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import axios from "axios";

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".mkv": "video/x-matroska",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
};

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/x-matroska": ".mkv",
  "audio/mpeg": ".mp3",
  "audio/wav": ".wav",
};

export function mimeFromPath(filePath: string): string {
  return MIME_BY_EXT[path.extname(filePath).toLowerCase()] ?? "image/png";
}

/** Reads a local file and returns its base64 payload plus guessed MIME type. */
export async function fileToBase64(
  filePath: string,
): Promise<{ base64: string; mimeType: string }> {
  const resolved = path.resolve(filePath);
  let buffer: Buffer;
  try {
    buffer = await fs.readFile(resolved);
  } catch {
    throw new Error(`Could not read input file: ${resolved}`);
  }
  return { base64: buffer.toString("base64"), mimeType: mimeFromPath(resolved) };
}

interface DownloadResult {
  path: string;
  url: string;
}

/**
 * Downloads a list of output URLs into `dir`, naming them
 * `<prefix>-<index><ext>`. Returns the local paths written.
 */
export async function downloadOutputs(
  outputs: Array<{ url: string; mimeType?: string; order?: number }>,
  dir: string,
  prefix: string,
): Promise<DownloadResult[]> {
  await fs.mkdir(dir, { recursive: true });
  const results: DownloadResult[] = [];

  for (let i = 0; i < outputs.length; i++) {
    const out = outputs[i];
    const ext = extForOutput(out.url, out.mimeType);
    const suffix = outputs.length > 1 ? `-${out.order ?? i}` : "";
    const dest = path.join(dir, `${prefix}${suffix}${ext}`);

    const resp = await axios.get<ArrayBuffer>(out.url, {
      responseType: "arraybuffer",
      timeout: 300_000,
      maxContentLength: Infinity,
    });
    await fs.writeFile(dest, Buffer.from(resp.data));
    results.push({ path: dest, url: out.url });
  }

  return results;
}

function extForOutput(url: string, mimeType?: string): string {
  if (mimeType && EXT_BY_MIME[mimeType]) return EXT_BY_MIME[mimeType];
  const fromUrl = path.extname(new URL(url).pathname).toLowerCase();
  if (fromUrl) return fromUrl;
  return mimeType?.startsWith("video/") ? ".mp4" : ".png";
}
