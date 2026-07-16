import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { GenerationsModule } from '../generations/generations.module';
import { CreditsModule } from '../credits/credits.module';
import { UploadsModule } from '../uploads/uploads.module';
import { McpConfig } from './mcp.config';
import { GeraewOAuthProvider } from './oauth/geraew-oauth.provider';
import { McpServerFactory } from './mcp-server.factory';
import { UploadSessionStore } from './upload-session.store';
import { McpService } from './mcp.service';

/**
 * Remote MCP connector (OAuth 2.1 + Streamable HTTP) served from this API.
 * McpService is mounted onto the Express instance from main.ts.
 */
@Module({
  imports: [
    PrismaModule,
    AuthModule,
    GenerationsModule,
    CreditsModule,
    UploadsModule,
    // Secret is supplied per-call by GeraewOAuthProvider (audience-bound MCP tokens).
    JwtModule.register({}),
  ],
  providers: [
    McpConfig,
    GeraewOAuthProvider,
    McpServerFactory,
    UploadSessionStore,
    McpService,
  ],
  exports: [McpService],
})
export class McpModule {}
