import { Injectable, Logger } from '@nestjs/common';
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
import { AuthService } from '../auth/auth.service';

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

    this.logger.log(
      `MCP connector mounted at ${this.config.resourceUrl.href} (issuer ${this.config.issuerUrl.href})`,
    );
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
