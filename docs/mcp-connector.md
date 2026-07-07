# GeraEW — Remote MCP Connector

Lets anyone connect GeraEW to Claude (claude.ai app, Claude Code, Cursor, etc.)
and generate images/videos using **their own** GeraEW account and credits.

**Connector URL:** `https://api.geraew.com.br/mcp`

## How a user connects (Claude app)

1. Settings → Connectors → **Add** custom connector.
2. Name it **GeraEW**, paste `https://api.geraew.com.br/mcp`.
3. Click **Connect** → a GeraEW login page opens → sign in (email/senha or Google).
4. Done — ask Claude to *"generate an image with GeraEW"*.

## How it works

The API is both the OAuth 2.1 authorization server and the MCP resource server:

| Endpoint | Purpose |
|---|---|
| `/.well-known/oauth-protected-resource/mcp` | RFC 9728 — points clients at the auth server |
| `/.well-known/oauth-authorization-server` | RFC 8414 — auth server metadata |
| `/register` | RFC 7591 dynamic client registration |
| `/authorize` | renders the GeraEW login/consent page |
| `POST /mcp-oauth/login` | validates credentials, issues the auth code |
| `/token` | authorization_code + refresh_token grants (PKCE) |
| `/mcp` | Streamable HTTP MCP endpoint (Bearer-protected) |

Access tokens are audience-bound JWTs (`aud = https://api.geraew.com.br/mcp`),
signed with `MCP_JWT_SECRET`. Each `/mcp` call runs in-process as the token's
user via `GenerationsService` / `CreditsService`.

Tools: `geraew_generate_image`, `geraew_generate_video_from_text`,
`geraew_generate_video_from_image`, `geraew_face_swap`, `geraew_get_generation`,
`geraew_list_generations`, `geraew_credit_balance`. Image inputs are passed as
public URLs; outputs come back as CDN URLs.

## Deploy checklist

1. **Migrate the DB** — creates 3 tables (`mcp_oauth_clients`, `mcp_auth_codes`,
   `mcp_refresh_tokens`):
   ```bash
   npx prisma db push        # recommended
   # or: psql "$DATABASE_URL" -f prisma/migrations-manual/mcp_oauth.sql
   ```
2. **Env** (see `.env.example`):
   - `MCP_PUBLIC_URL=https://api.geraew.com.br`
   - `MCP_JWT_SECRET=<long random secret>`
   - `GOOGLE_CLIENT_ID` (already set) — enables the Google button. Add
     `https://api.geraew.com.br` to the Google OAuth **authorized JavaScript
     origins** so GSI renders on the login page.
3. Deploy the API and confirm:
   ```bash
   curl https://api.geraew.com.br/.well-known/oauth-authorization-server
   curl https://api.geraew.com.br/.well-known/oauth-protected-resource/mcp
   ```

## Notes / limitations

- The consent page auto-approves on successful login (no separate consent
  screen). Add one later if you want explicit scope consent.
- Access tokens live 1h; refresh tokens 30d (rotated on use).
- Free-plan Veo restrictions and per-plan credit rules apply exactly as in the app.
