# Savetrix as a Claude Custom Connector (remote + OAuth)

This makes Savetrix a **one-click connector** in Claude — like the Slack/Notion
connectors. A non-technical user just:

1. Settings → Connectors → **Add custom connector**
2. Pastes the connector URL
3. Claude opens a **browser** → they sign in to Savetrix → approve
4. Done — the 33 Savetrix tools are available, no config files.

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
| `/upload` | ticketed browser invoice upload (see below) |
| `/healthz` | health check |

## Uploading invoices through a remote connector

This is the one operation that cannot work the obvious way, and it is worth
understanding before changing `savetrix_invoice_upload`.

Claude connects to this server **from Anthropic's cloud**, not from the user's
machine. So:

- `filePath` can never work remotely. A path the user sees in chat (e.g.
  `/mnt/user-data/uploads/bill.pdf`) lives in Claude's own sandbox and will
  always fail here with `ENOENT`. `filePath` is for stdio/local installs only.
- `fileBase64` cannot carry a real invoice. Claude's MCP client rejects large
  string arguments *before the request reaches this server* — failures start
  around 13–16 KB of string content, and base64 in connectors breaks near
  ~11 K characters (≈8 KB of binary). A 200 KB PDF is ~270 KB of base64. The
  cap is enforced explicitly in `resolveUploadSource()` so the failure is a
  clear message instead of a truncated argument.

The two paths that do work:

1. **`fileUrl`** — a public https link. The server downloads the bytes itself.
   Zero clicks. URLs pointing at loopback/private/link-local hosts are refused
   so the connector can't be used to reach internal services.
2. **Browser upload** — `savetrix_invoice_upload_link` (or calling
   `savetrix_invoice_upload` with no arguments) returns a link to `/upload?t=…`.
   The ticket is an encrypted JWT wrapping the caller's already-verified
   Savetrix session, valid 30 minutes, so the page needs no second login. The
   page POSTs the file as the **raw request body** (not multipart), which is why
   no multipart parser dependency is needed.

`savetrix_invoice_upload` also converts an `ENOENT` into the upload link rather
than surfacing a raw filesystem error, since a sandbox path is the most common
thing a model will try first.

> **Size ceiling on Vercel:** a serverless function's request body is capped at
> ~4.5 MB, so the upload page advertises 4 MB when `VERCEL` is set and the API's
> full 50 MB otherwise. That 50 MB ceiling isn't a documented Savetrix backend
> limit — the web app's own upload flow enforces none at all — it's just a
> safety cap sized for real scanned invoices/photos. `fileUrl` is unaffected by
> the Vercel body cap (the server downloads it directly), so it's the answer
> for any file over 4 MB. Raising the browser-upload path itself means moving
> uploads off the function (direct-to-storage signed URL).

### Why `invoiceUploadSchema` must stay a flat `z.object`

A `z.union` there serializes to a **top-level `anyOf`**, which is illegal for a
tool `input_schema` — Anthropic's API requires `type: "object"` at the root. The
MCP SDK does not error on it; it silently emits `{"type":"object","properties":{}}`,
i.e. a tool Claude sees as taking **no arguments at all**. That is precisely how
remote uploads broke once already. `src/test/client.test.ts` asserts the emitted
schema stays a flat object with real properties — keep that test.

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

### Moving to a new domain without breaking existing connections

Pointing `SAVETRIX_PUBLIC_URL` at a new domain while an old alias still resolves
leaves the alias advertising the *new* host as its resource. A client that
validates protected-resource metadata (RFC 9728 / the MCP auth spec) can reject
that mismatch as "no MCP server found at the provided URL" — the same failure
mode as commit `71abb07`.

List the old hostname so it advertises itself instead:

```bash
vercel env add SAVETRIX_ALLOWED_HOSTS
# e.g. old-project-name.vercel.app     (comma-separated, hostnames only)
```

Each allowlisted host then serves its own `issuer`, `authorization_endpoint`,
`token_endpoint`, `registration_endpoint`, `resource`, the matching
`resource_metadata` pointer on a 401, and upload links on its own origin.
Anything *not* listed falls back to the canonical URL — the Host header is never
trusted blindly, or a spoofed one could hand a client metadata pointing its
`/token` calls at a domain you don't own.

Tokens are host-independent (encrypted with `SAVETRIX_TOKEN_SECRET`), so
sessions survive the switch. Once everyone has moved, drop the alias from
`SAVETRIX_ALLOWED_HOSTS` and remove it in Vercel.

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
token → `initialize` → `tools/list` (33 tools) → `tools/call` returns data.

## Notes

- The old **stdio** mode (`node dist/index.js`, Claude Desktop config file) still
  works for a single local user. Remote/OAuth is the multi-user, click-to-add path.
- Tokens are encrypted with `SAVETRIX_TOKEN_SECRET`. Rotating it invalidates all
  existing connections (users just re-authorize).
- Access tokens live 8h; refresh tokens 30d; the wrapped Savetrix token refreshes
  automatically on 401.
