import { Injectable, Logger } from '@nestjs/common';
import * as express from 'express';
import type { Express, Request, Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  mcpAuthRouter,
  getOAuthProtectedResourceMetadataUrl,
} from '@modelcontextprotocol/sdk/server/auth/router.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import { McpConfig } from './mcp.config';
import { GeraewOAuthProvider, LOGIN_PAGE_CSP } from './oauth/geraew-oauth.provider';
import { McpServerFactory } from './mcp-server.factory';
import { renderLoginPage } from './oauth/login-page';
import { renderUploadPage, UPLOAD_PAGE_CSP } from './upload-page';
import { UploadSessionStore } from './upload-session.store';
import { UploadsService } from '../uploads/uploads.service';
import { AuthService } from '../auth/auth.service';

/** Content types accepted by the drop page → file extension. */
const UPLOAD_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/**
 * Mounts the remote MCP connector on the underlying Express app:
 *   - OAuth metadata + /authorize + /token + /register + /revoke (SDK router)
 *   - POST /mcp-oauth/login   (custom credential handler that issues the code)
 *   - POST /mcp               (Streamable HTTP MCP endpoint, Bearer-protected)
 */
@Injectable()
export class McpService {
  private readonly logger = new Logger(McpService.name);

  constructor(
    private readonly config: McpConfig,
    private readonly provider: GeraewOAuthProvider,
    private readonly factory: McpServerFactory,
    private readonly authService: AuthService,
    private readonly uploadSessions: UploadSessionStore,
    private readonly uploads: UploadsService,
  ) {}

  mount(app: Express): void {
    const resourceMetadataUrl = getOAuthProtectedResourceMetadataUrl(
      this.config.resourceUrl,
    );

    // OAuth authorization-server + protected-resource metadata and endpoints.
    app.use(
      mcpAuthRouter({
        provider: this.provider,
        issuerUrl: this.config.issuerUrl,
        resourceServerUrl: this.config.resourceUrl,
        scopesSupported: this.config.scopesSupported,
        resourceName: 'GeraEW',
      }),
    );

    // Credential submission from the consent page.
    app.post('/mcp-oauth/login', (req, res) => {
      this.handleLogin(req, res).catch((err) => {
        this.logger.error(`login handler error: ${err?.message}`);
        if (!res.headersSent) res.status(500).send('Internal error');
      });
    });

    // The MCP endpoint itself.
    app.post(
      '/mcp',
      requireBearerAuth({ verifier: this.provider, resourceMetadataUrl }),
      (req, res) => {
        this.handleMcp(req, res).catch((err) => {
          this.logger.error(`mcp handler error: ${err?.message}`);
          if (!res.headersSent) {
            res.status(500).json({
              jsonrpc: '2.0',
              error: { code: -32603, message: 'Internal error' },
              id: null,
            });
          }
        });
      },
    );

    // ── "Bring your own image" drop page ──────────────────────────────
    // Unauthenticated on purpose: the opaque session token in the path is the
    // capability. Created by the MCP tool `geraew_upload_image`; the user opens
    // the link and drops their image, which the tool then references by URL.
    const rawImage = express.raw({ type: () => true, limit: '30mb' });
    // The MCP Apps upload widget runs in a sandboxed (opaque-origin) iframe, so
    // its POST is cross-origin and triggers a CORS preflight. The opaque token
    // in the path is the capability, so a wildcard origin is acceptable here.
    app.options('/u/:token', (_req, res) => {
      this.setUploadCors(res);
      res.status(204).end();
    });
    app.get('/u/:token', (req, res) => this.renderDrop(req, res));
    app.post('/u/:token', rawImage, (req, res) => {
      this.handleUpload(req, res).catch((err) => {
        this.logger.error(`upload handler error: ${err?.message}`);
        if (!res.headersSent) {
          this.setUploadCors(res);
          res.status(500).json({ ok: false, message: 'Internal error' });
        }
      });
    });

    this.logger.log(
      `MCP connector mounted at ${this.config.resourceUrl.href} (issuer ${this.config.issuerUrl.href})`,
    );
  }

  /** Serves the drop page for an upload session (or an expired/done state). */
  private renderDrop(req: Request, res: Response): void {
    const token = String(req.params.token ?? '');
    const session = this.uploadSessions.get(token);
    const html = session
      ? renderUploadPage({
          action: `/u/${encodeURIComponent(token)}`,
          alreadyUrl:
            session.status === 'completed' ? session.imageUrl : undefined,
        })
      : renderUploadPage({ action: '', expired: true });
    res
      .status(session ? 200 : 410)
      .set('Content-Type', 'text/html; charset=utf-8')
      .set('Content-Security-Policy', UPLOAD_PAGE_CSP)
      .send(html);
  }

  /** Permissive CORS for the token-capability upload endpoint (see mount()). */
  private setUploadCors(res: Response): void {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '600');
  }

  /** Receives the raw image bytes, stores them in R2, completes the session. */
  private async handleUpload(req: Request, res: Response): Promise<void> {
    this.setUploadCors(res);
    const token = String(req.params.token ?? '');
    const session = this.uploadSessions.get(token);
    if (!session) {
      res.status(410).json({ ok: false, message: 'Link expirado.' });
      return;
    }

    const contentType = String(req.headers['content-type'] ?? '')
      .split(';')[0]
      .trim()
      .toLowerCase();
    const ext = UPLOAD_EXT[contentType];
    if (!ext) {
      res.status(400).json({
        ok: false,
        message: 'Formato não suportado. Use PNG, JPG ou WEBP.',
      });
      return;
    }

    const body = req.body as unknown;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      res.status(400).json({ ok: false, message: 'Arquivo vazio.' });
      return;
    }
    if (body.length > MAX_UPLOAD_BYTES) {
      res
        .status(400)
        .json({ ok: false, message: 'Arquivo muito grande (máx 25MB).' });
      return;
    }

    const url = await this.uploads.uploadBuffer(
      body,
      `mcp-uploads/${session.userId}`,
      `reference.${ext}`,
      contentType,
    );
    this.uploadSessions.complete(token, url);
    this.logger.log(
      `MCP upload stored for session ${token} (${body.length} bytes)`,
    );
    res.status(200).json({ ok: true, url });
  }

  private async handleLogin(req: Request, res: Response): Promise<void> {
    const b = req.body ?? {};
    const clientId = String(b.client_id ?? '');
    const redirectUri = String(b.redirect_uri ?? '');
    const codeChallenge = String(b.code_challenge ?? '');
    const codeChallengeMethod = String(b.code_challenge_method ?? 'S256');
    const state = b.state ? String(b.state) : undefined;
    const scope = b.scope ? String(b.scope) : undefined;
    const resource = b.resource ? String(b.resource) : undefined;
    const googleIdToken = b.google_id_token ? String(b.google_id_token) : '';
    const email = b.email ? String(b.email) : '';
    const password = b.password ? String(b.password) : '';

    const client = await this.provider.clientsStore.getClient(clientId);
    if (!client) {
      res.status(400).send('Unknown client');
      return;
    }
    // Open-redirect guard: redirect_uri must be one the client registered.
    if (!client.redirect_uris?.includes(redirectUri)) {
      res.status(400).send('Invalid redirect_uri');
      return;
    }

    const rerender = (error: string): void => {
      res
        .status(401)
        .set('Content-Type', 'text/html; charset=utf-8')
        .set('Content-Security-Policy', LOGIN_PAGE_CSP)
        .send(
          renderLoginPage({
            clientId,
            clientName: client.client_name,
            redirectUri,
            codeChallenge,
            codeChallengeMethod,
            state,
            scope,
            resource,
            googleClientId: this.config.googleClientId,
            error,
          }),
        );
    };

    // Authenticate the user with their GeraEW account.
    let userId: string | undefined;
    try {
      if (googleIdToken) {
        const auth = await this.authService.googleAuthWithToken(googleIdToken);
        userId = auth.user.id;
      } else {
        const user = await this.authService.validateUser(email, password);
        if (!user) {
          rerender('Email ou senha inválidos.');
          return;
        }
        if (!user.emailVerified) {
          rerender('Confirme seu email antes de conectar.');
          return;
        }
        userId = user.id;
      }
    } catch {
      rerender('Falha na autenticação. Tente novamente.');
      return;
    }

    const scopes = scope ? scope.split(' ') : this.config.scopesSupported;
    const code = await this.provider.createAuthorizationCode({
      clientId,
      userId: userId!,
      redirectUri,
      codeChallenge,
      codeChallengeMethod,
      scopes,
      resource,
    });

    // Redirect back to the client with the authorization code (RFC 9207 iss).
    const target = new URL(redirectUri);
    target.searchParams.set('code', code);
    if (state) target.searchParams.set('state', state);
    // RFC 9207: iss MUST exactly match the advertised issuer (incl. trailing slash).
    target.searchParams.set('iss', this.config.issuerUrl.href);
    res.redirect(302, target.href);
  }

  private async handleMcp(req: Request, res: Response): Promise<void> {
    const userId = (req.auth?.extra as { userId?: string } | undefined)?.userId;
    if (!userId) {
      res.status(401).json({
        jsonrpc: '2.0',
        error: { code: -32001, message: 'Unauthorized' },
        id: null,
      });
      return;
    }

    const server = this.factory.build(userId);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    res.on('close', () => {
      transport.close();
      server.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  }
}
