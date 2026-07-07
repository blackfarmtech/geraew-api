import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Central configuration for the remote MCP OAuth server.
 *
 * The public base URL is where this API is reachable from the internet
 * (e.g. https://api.geraew.com.br). The MCP resource identifier — the value
 * users paste into their client and the OAuth token audience — is
 * `<publicUrl>/mcp`.
 */
@Injectable()
export class McpConfig {
  constructor(private readonly config: ConfigService) {}

  /** Public base URL of the API (no trailing slash). */
  get publicUrl(): string {
    const raw =
      this.config.get<string>('MCP_PUBLIC_URL') ??
      this.config.get<string>('PUBLIC_API_URL') ??
      'http://localhost:3000';
    return raw.replace(/\/+$/, '');
  }

  /** OAuth issuer / authorization server identifier. */
  get issuerUrl(): URL {
    return new URL(this.publicUrl);
  }

  /** Canonical MCP resource identifier (RFC 8707 audience). */
  get resourceUrl(): URL {
    return new URL(`${this.publicUrl}/mcp`);
  }

  /** Secret used to sign MCP access tokens (audience-bound, app-independent). */
  get jwtSecret(): string {
    return (
      this.config.get<string>('MCP_JWT_SECRET') ??
      this.config.getOrThrow<string>('JWT_ACCESS_SECRET')
    );
  }

  /** Google client id used by the "Sign in with Google" button on the consent page. */
  get googleClientId(): string | undefined {
    return this.config.get<string>('GOOGLE_CLIENT_ID');
  }

  readonly accessTokenTtlSeconds = 60 * 60; // 1 hour
  readonly authCodeTtlSeconds = 10 * 60; // 10 minutes
  readonly refreshTokenTtlSeconds = 30 * 24 * 60 * 60; // 30 days

  /** The single scope this server exposes. */
  readonly scopesSupported = ['geraew:generate'];
}
