import { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';
import { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js';
import { PrismaService } from '../../prisma/prisma.service';
import type { McpOAuthClient } from '@prisma/client';

/**
 * Persists dynamically-registered OAuth clients (RFC 7591) in Postgres so the
 * connector survives restarts and works across multiple API instances.
 */
export class PrismaClientsStore implements OAuthRegisteredClientsStore {
  constructor(private readonly prisma: PrismaService) {}

  async getClient(
    clientId: string,
  ): Promise<OAuthClientInformationFull | undefined> {
    const client = await this.prisma.mcpOAuthClient.findUnique({
      where: { clientId },
    });
    return client ? this.toClientInfo(client) : undefined;
  }

  async registerClient(
    client: OAuthClientInformationFull,
  ): Promise<OAuthClientInformationFull> {
    // The SDK register handler has already assigned client_id / secret.
    const saved = await this.prisma.mcpOAuthClient.create({
      data: {
        clientId: client.client_id,
        clientSecretHash: client.client_secret ?? null,
        clientName: client.client_name ?? null,
        redirectUris: client.redirect_uris ?? [],
        grantTypes: client.grant_types ?? ['authorization_code', 'refresh_token'],
        responseTypes: client.response_types ?? ['code'],
        scope: client.scope ?? null,
        tokenEndpointAuthMethod: client.token_endpoint_auth_method ?? 'none',
        clientIdIssuedAt: client.client_id_issued_at ?? null,
        clientSecretExpiresAt: client.client_secret_expires_at ?? null,
      },
    });
    return this.toClientInfo(saved);
  }

  private toClientInfo(c: McpOAuthClient): OAuthClientInformationFull {
    return {
      client_id: c.clientId,
      client_secret: c.clientSecretHash ?? undefined,
      client_name: c.clientName ?? undefined,
      redirect_uris: c.redirectUris,
      grant_types: c.grantTypes,
      response_types: c.responseTypes,
      scope: c.scope ?? undefined,
      token_endpoint_auth_method: c.tokenEndpointAuthMethod ?? 'none',
      client_id_issued_at: c.clientIdIssuedAt ?? undefined,
      client_secret_expires_at: c.clientSecretExpiresAt ?? undefined,
    };
  }
}
