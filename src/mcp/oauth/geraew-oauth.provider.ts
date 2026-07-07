import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Response } from 'express';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  OAuthServerProvider,
  AuthorizationParams,
} from '@modelcontextprotocol/sdk/server/auth/provider.js';
import { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';
import {
  OAuthClientInformationFull,
  OAuthTokens,
  OAuthTokenRevocationRequest,
} from '@modelcontextprotocol/sdk/shared/auth.js';
import { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import {
  InvalidGrantError,
  InvalidTokenError,
} from '@modelcontextprotocol/sdk/server/auth/errors.js';
import { PrismaService } from '../../prisma/prisma.service';
import { McpConfig } from '../mcp.config';
import { PrismaClientsStore } from './prisma-clients.store';
import { renderLoginPage } from './login-page';

const sha256 = (value: string): string =>
  createHash('sha256').update(value).digest('hex');

/** CSP allowing the inline login page + Google Identity Services to run. */
export const LOGIN_PAGE_CSP =
  "default-src 'self'; " +
  "script-src 'self' 'unsafe-inline' https://accounts.google.com https://apis.google.com; " +
  "style-src 'self' 'unsafe-inline' https://accounts.google.com; " +
  "frame-src https://accounts.google.com; " +
  "connect-src 'self' https://accounts.google.com; " +
  "img-src 'self' data: https:;";

interface McpAccessTokenPayload {
  sub: string;
  client_id: string;
  scope: string;
  aud: string;
  typ: 'mcp';
}

/**
 * OAuth 2.1 authorization server + resource-server logic for the MCP connector,
 * backed by GeraEW user accounts. Tokens are audience-bound JWTs; refresh tokens
 * are opaque and stored hashed in Postgres.
 */
@Injectable()
export class GeraewOAuthProvider implements OAuthServerProvider {
  private readonly store: PrismaClientsStore;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: McpConfig,
  ) {
    this.store = new PrismaClientsStore(prisma);
  }

  get clientsStore(): OAuthRegisteredClientsStore {
    return this.store;
  }

  /**
   * Start of the flow: render the GeraEW login/consent page. The actual code
   * issuance happens after the user authenticates via POST /mcp-oauth/login.
   */
  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response,
  ): Promise<void> {
    res
      .status(200)
      .set('Content-Type', 'text/html; charset=utf-8')
      .set('Content-Security-Policy', LOGIN_PAGE_CSP)
      .send(
        renderLoginPage({
          clientId: client.client_id,
          clientName: client.client_name,
          redirectUri: params.redirectUri,
          codeChallenge: params.codeChallenge,
          codeChallengeMethod: 'S256',
          state: params.state,
          scope: params.scopes?.join(' '),
          resource: params.resource?.href,
          googleClientId: this.config.googleClientId,
        }),
      );
  }

  /**
   * Issues an authorization code after successful login. Called by the custom
   * login endpoint (not the SDK router). Returns the code to redirect with.
   */
  async createAuthorizationCode(input: {
    clientId: string;
    userId: string;
    redirectUri: string;
    codeChallenge: string;
    codeChallengeMethod?: string;
    scopes: string[];
    resource?: string;
  }): Promise<string> {
    const code = randomBytes(32).toString('hex');
    await this.prisma.mcpAuthCode.create({
      data: {
        code,
        clientId: input.clientId,
        userId: input.userId,
        redirectUri: input.redirectUri,
        codeChallenge: input.codeChallenge,
        codeChallengeMethod: input.codeChallengeMethod ?? 'S256',
        scopes: input.scopes,
        resource: input.resource ?? null,
        expiresAt: new Date(Date.now() + this.config.authCodeTtlSeconds * 1000),
      },
    });
    return code;
  }

  async challengeForAuthorizationCode(
    _client: OAuthClientInformationFull,
    authorizationCode: string,
  ): Promise<string> {
    const record = await this.prisma.mcpAuthCode.findUnique({
      where: { code: authorizationCode },
    });
    if (!record) throw new InvalidGrantError('Authorization code not found');
    return record.codeChallenge;
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    _codeVerifier?: string,
    redirectUri?: string,
    resource?: URL,
  ): Promise<OAuthTokens> {
    const record = await this.prisma.mcpAuthCode.findUnique({
      where: { code: authorizationCode },
    });
    if (!record) throw new InvalidGrantError('Authorization code not found');

    // One-time use.
    await this.prisma.mcpAuthCode.delete({ where: { code: authorizationCode } });

    if (record.clientId !== client.client_id) {
      throw new InvalidGrantError('Authorization code was issued to another client');
    }
    if (record.expiresAt < new Date()) {
      throw new InvalidGrantError('Authorization code expired');
    }
    if (redirectUri && redirectUri !== record.redirectUri) {
      throw new InvalidGrantError('redirect_uri mismatch');
    }

    return this.issueTokens({
      userId: record.userId,
      clientId: client.client_id,
      scopes: record.scopes,
      resource: resource?.href ?? record.resource ?? undefined,
    });
  }

  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refreshToken: string,
    scopes?: string[],
    resource?: URL,
  ): Promise<OAuthTokens> {
    const tokenHash = sha256(refreshToken);
    const record = await this.prisma.mcpRefreshToken.findUnique({
      where: { tokenHash },
    });
    if (!record || record.revoked) {
      throw new InvalidGrantError('Invalid refresh token');
    }
    if (record.clientId !== client.client_id) {
      throw new InvalidGrantError('Refresh token was issued to another client');
    }
    if (record.expiresAt < new Date()) {
      throw new InvalidGrantError('Refresh token expired');
    }

    // Rotate: revoke the old refresh token and issue a fresh pair.
    await this.prisma.mcpRefreshToken.update({
      where: { tokenHash },
      data: { revoked: true },
    });

    return this.issueTokens({
      userId: record.userId,
      clientId: client.client_id,
      scopes: scopes?.length ? scopes : record.scopes,
      resource: resource?.href ?? record.resource ?? undefined,
    });
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    let payload: McpAccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<McpAccessTokenPayload>(token, {
        secret: this.config.jwtSecret,
      });
    } catch {
      throw new InvalidTokenError('Token is invalid or expired');
    }
    if (payload.typ !== 'mcp') {
      throw new InvalidTokenError('Wrong token type');
    }
    // Audience binding (RFC 8707): the token must target this MCP server.
    if (payload.aud !== this.config.resourceUrl.href) {
      throw new InvalidTokenError('Token audience does not match this server');
    }
    return {
      token,
      clientId: payload.client_id,
      scopes: payload.scope ? payload.scope.split(' ') : [],
      resource: new URL(payload.aud),
      extra: { userId: payload.sub },
    };
  }

  async revokeToken(
    client: OAuthClientInformationFull,
    request: OAuthTokenRevocationRequest,
  ): Promise<void> {
    const tokenHash = sha256(request.token);
    await this.prisma.mcpRefreshToken.updateMany({
      where: { tokenHash, clientId: client.client_id },
      data: { revoked: true },
    });
  }

  private async issueTokens(input: {
    userId: string;
    clientId: string;
    scopes: string[];
    resource?: string;
  }): Promise<OAuthTokens> {
    const audience = input.resource ?? this.config.resourceUrl.href;
    const scope = input.scopes.join(' ');

    const accessToken = await this.jwt.signAsync(
      {
        sub: input.userId,
        client_id: input.clientId,
        scope,
        aud: audience,
        typ: 'mcp',
      } satisfies McpAccessTokenPayload,
      {
        secret: this.config.jwtSecret,
        expiresIn: this.config.accessTokenTtlSeconds,
      },
    );

    const refreshToken = randomBytes(32).toString('hex');
    await this.prisma.mcpRefreshToken.create({
      data: {
        tokenHash: sha256(refreshToken),
        clientId: input.clientId,
        userId: input.userId,
        scopes: input.scopes,
        resource: input.resource ?? null,
        expiresAt: new Date(
          Date.now() + this.config.refreshTokenTtlSeconds * 1000,
        ),
      },
    });

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: this.config.accessTokenTtlSeconds,
      refresh_token: refreshToken,
      scope,
    };
  }

  /** Generates the id used as the OAuth `code` value (exposed for tests/tools). */
  static newOpaqueId(): string {
    return randomUUID();
  }
}
