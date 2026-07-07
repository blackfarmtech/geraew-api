-- =====================================================================
-- MCP OAuth connector — schema for the remote MCP server.
-- Adds 3 tables: dynamically-registered clients, authorization codes,
-- and refresh tokens. Access tokens are stateless JWTs (not stored).
--
-- HOW TO APPLY (choose one):
--   1) Recommended — let Prisma create them (matches the schema exactly):
--        npx prisma db push
--      (This creates only these 3 new tables; existing tables are untouched.)
--   2) Or run this SQL directly against the production database.
--
-- Safe to run once. Idempotent via IF NOT EXISTS.
-- =====================================================================

CREATE TABLE IF NOT EXISTS "mcp_oauth_clients" (
    "id"                          TEXT NOT NULL,
    "client_id"                   TEXT NOT NULL,
    "client_secret_hash"          TEXT,
    "client_name"                 TEXT,
    "redirect_uris"               TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "grant_types"                 TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "response_types"              TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "scope"                       TEXT,
    "token_endpoint_auth_method"  TEXT,
    "client_id_issued_at"         INTEGER,
    "client_secret_expires_at"    INTEGER,
    "created_at"                  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mcp_oauth_clients_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "mcp_oauth_clients_client_id_key"
    ON "mcp_oauth_clients" ("client_id");

CREATE TABLE IF NOT EXISTS "mcp_auth_codes" (
    "id"                    TEXT NOT NULL,
    "code"                  TEXT NOT NULL,
    "client_id"             TEXT NOT NULL,
    "user_id"               TEXT NOT NULL,
    "redirect_uri"          TEXT NOT NULL,
    "code_challenge"        TEXT NOT NULL,
    "code_challenge_method" TEXT NOT NULL DEFAULT 'S256',
    "resource"              TEXT,
    "scopes"                TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "expires_at"            TIMESTAMP(3) NOT NULL,
    "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mcp_auth_codes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "mcp_auth_codes_code_key"
    ON "mcp_auth_codes" ("code");
CREATE INDEX IF NOT EXISTS "mcp_auth_codes_user_id_idx"
    ON "mcp_auth_codes" ("user_id");

CREATE TABLE IF NOT EXISTS "mcp_refresh_tokens" (
    "id"         TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "client_id"  TEXT NOT NULL,
    "user_id"    TEXT NOT NULL,
    "scopes"     TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "resource"   TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked"    BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mcp_refresh_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "mcp_refresh_tokens_token_hash_key"
    ON "mcp_refresh_tokens" ("token_hash");
CREATE INDEX IF NOT EXISTS "mcp_refresh_tokens_user_id_idx"
    ON "mcp_refresh_tokens" ("user_id");
CREATE INDEX IF NOT EXISTS "mcp_refresh_tokens_token_hash_idx"
    ON "mcp_refresh_tokens" ("token_hash");
