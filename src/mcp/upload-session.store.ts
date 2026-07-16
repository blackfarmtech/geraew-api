import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';

export type UploadSessionStatus = 'pending' | 'completed';

export interface UploadSession {
  token: string;
  userId: string;
  status: UploadSessionStatus;
  /** Public CDN URL of the uploaded image (set once status === 'completed'). */
  imageUrl?: string;
  createdAt: number;
  expiresAt: number;
}

/**
 * In-memory store for "bring your own image" upload sessions used by the MCP
 * `geraew_upload_image` flow. A session is a short-lived capability: the MCP
 * tool creates one (scoped to the authenticated user) and hands the user an
 * unguessable drop-page URL; the drop page fills it in once the image lands.
 *
 * NOTE: state lives in this process's memory. It works because the MCP
 * endpoint and the drop-page routes are served by the same Express instance.
 * If the API is ever scaled to multiple instances behind a load balancer, the
 * poll (`geraew_get_upload`) and the upload POST may hit different instances —
 * move this to Redis/DB at that point (keep the same interface).
 */
@Injectable()
export class UploadSessionStore {
  private readonly logger = new Logger(UploadSessionStore.name);
  private readonly sessions = new Map<string, UploadSession>();

  /** How long a created upload link stays valid. */
  private readonly ttlMs = 15 * 60 * 1000;

  /** Creates a pending session for the user and returns its token. */
  create(userId: string): string {
    this.prune();
    const token = randomBytes(18).toString('base64url'); // 24 url-safe chars
    const now = Date.now();
    this.sessions.set(token, {
      token,
      userId,
      status: 'pending',
      createdAt: now,
      expiresAt: now + this.ttlMs,
    });
    return token;
  }

  /** Returns a live (non-expired) session, or undefined. */
  get(token: string): UploadSession | undefined {
    const s = this.sessions.get(token);
    if (!s) return undefined;
    if (Date.now() > s.expiresAt) {
      this.sessions.delete(token);
      return undefined;
    }
    return s;
  }

  /** Marks a session completed with the uploaded image's public URL. */
  complete(token: string, imageUrl: string): boolean {
    const s = this.get(token);
    if (!s) return false;
    s.status = 'completed';
    s.imageUrl = imageUrl;
    return true;
  }

  /** Drops expired sessions. Cheap; called on create. */
  private prune(): void {
    const now = Date.now();
    for (const [token, s] of this.sessions) {
      if (now > s.expiresAt) this.sessions.delete(token);
    }
  }
}
