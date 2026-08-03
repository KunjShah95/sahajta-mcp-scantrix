# Savetrix as a Claude Custom Connector (remote + OAuth)

This makes Savetrix a **one-click connector** in Claude — like the Slack/Notion
connectors. A non-technical user just:

1. Settings → Connectors → **Add custom connector**
2. Pastes the connector URL
3. Claude opens a **browser** → they sign in to Savetrix → approve
4. Done — the 32 Savetrix tools are available, no config files.

It works because the server is a full **OAuth 2.1 authorization server** (MCP
2025-06-18 auth spec) plus the MCP **Streamable HTTP** endpoint. Savetrix isn't
an OAuth provider, so the connector hosts its own `/login` page that signs into
Savetrix and mints encrypted tokens wrapping that session. Everything is
**stateless** (tokens are encrypted JWTs), so it runs on serverless with no DB.

## Endpoints (all automatic)

| Path | Purpose |
|------|---------|
| `/.well-known/oauth-protected-resource` | RFC 9728 resource metadata |
| `/.well-known/oauth-authorization-server` | RFC 8414 AS metadata |
| `/authorize` | starts auth → redirects to `/login` |
| `/login` | Savetrix email/password sign-in page |
| `/token` | code → access/refresh token (PKCE) |
| `/register` | dynamic client registration |
| `/mcp` | the MCP endpoint (bearer-protected) |
| `/healthz` | health check |

## Deploy to Vercel

From the `mcp-server/` directory:

```bash
npm i -g vercel          # if not installed
vercel                   # first deploy (creates the project) → note the URL
```

Set the two required env vars (Vercel dashboard → Settings → Environment
Variables, or CLI):

```bash
# a strong random secret (>=32 chars)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

vercel env add SAVETRIX_TOKEN_SECRET     # paste the value above
vercel env add SAVETRIX_PUBLIC_URL       # e.g. https://savetrix-mcp.vercel.app
```

`SAVETRIX_PUBLIC_URL` **must exactly match** the deployed domain (it's the OAuth
issuer). Optional: `SAVETRIX_API_URL`, `SAVETRIX_WEB_URL`.

Then deploy to production:

```bash
vercel --prod
```

Verify:

```bash
curl https://<your>.vercel.app/.well-known/oauth-authorization-server
curl https://<your>.vercel.app/healthz
```

## Add it in Claude

- **Claude.ai / Claude Desktop:** Settings → **Connectors** → **Add custom
  connector** → paste `https://<your>.vercel.app/mcp` → Connect → a browser
  opens → sign in with Savetrix → approve.
- **Claude Code:** `claude mcp add --transport http savetrix https://<your>.vercel.app/mcp`
  then run any savetrix tool; it triggers the browser OAuth.

After authorizing, the QuickBooks step still uses `savetrix_qb_connect` /
`savetrix_get_started`, which return the clickable Intuit authorize link.

## How the flow works

```
Claude ──/mcp (no token)──▶ 401 + WWW-Authenticate
Claude ──discover──▶ .well-known metadata
Claude ──POST /register──▶ client_id (stateless JWT)
Claude ──browser: /authorize──▶ 302 /login
User   ──/login (Savetrix email+pw)──▶ validates vs api.savetrix.com ──▶ 302 back with code
Claude ──POST /token (+PKCE)──▶ access_token (encrypted JWT wrapping Savetrix session)
Claude ──/mcp (Bearer)──▶ tools run as that user
```

## Local test

```bash
SAVETRIX_PUBLIC_URL=http://localhost:8791 \
SAVETRIX_TOKEN_SECRET=test-secret-of-at-least-32-characters-long \
SAVETRIX_PORT=8791 node dist/index.js --remote
```

Verified end-to-end locally: DCR → authorize → login (real Savetrix creds) →
token → `initialize` → `tools/list` (32 tools) → `tools/call` returns data.

## Notes

- The old **stdio** mode (`node dist/index.js`, Claude Desktop config file) still
  works for a single local user. Remote/OAuth is the multi-user, click-to-add path.
- Tokens are encrypted with `SAVETRIX_TOKEN_SECRET`. Rotating it invalidates all
  existing connections (users just re-authorize).
- Access tokens live 8h; refresh tokens 30d; the wrapped Savetrix token refreshes
  automatically on 401.
