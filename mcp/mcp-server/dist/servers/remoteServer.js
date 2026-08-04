import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { mcpAuthRouter, getOAuthProtectedResourceMetadataUrl, } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { createClientForTokens } from "../client/savetrixClient.js";
import { registerSavetrixTools } from "../tools/index.js";
import { SavetrixOAuthProvider } from "../auth/provider.js";
import { loginPage } from "../auth/loginPage.js";
import { uploadPage } from "../auth/uploadPage.js";
import { encryptToken, decryptToken } from "../auth/tokens.js";
import { uploadInvoiceBytes, MAX_UPLOAD_BYTES } from "../client/invoices.js";
/** How long a browser upload link stays valid — long enough to find the file. */
const UPLOAD_TICKET_TTL = 60 * 30;
/**
 * Vercel caps a serverless function's request body at ~4.5 MB, so promising
 * the API's full 20 MB there would just turn into an opaque 413. Advertise
 * whichever ceiling actually applies.
 */
const maxBrowserUploadBytes = () => process.env.VERCEL ? 4 * 1024 * 1024 : MAX_UPLOAD_BYTES;
/**
 * Builds the remote connector Express app: an OAuth 2.1 authorization server
 * (so Claude's "Add custom connector" browser flow works) plus the MCP
 * Streamable HTTP endpoint, protected by bearer tokens.
 */
export const createRemoteApp = (config) => {
    if (!config.publicUrl) {
        throw new Error("SAVETRIX_PUBLIC_URL must be set for the remote connector.");
    }
    const issuerUrl = new URL(config.publicUrl);
    // The actual protected resource is /mcp, not the site root. Without this,
    // mcpAuthRouter defaults resourceServerUrl to the issuer (site root), so
    // the advertised protected-resource metadata says "resource: <root>" while
    // clients are actually connecting to ".../mcp" — a mismatch that a
    // resource-validating client (per RFC 9728 / the MCP authorization spec)
    // can reject as "no MCP server found at the provided URL", even though
    // the OAuth login itself succeeded. Confirmed against
    // @modelcontextprotocol/sdk's own router.js: getOAuthProtectedResourceMetadataUrl's
    // doc example is literally `.../mcp` -> `.../.well-known/oauth-protected-resource/mcp`.
    const resourceUrl = new URL("/mcp", issuerUrl);
    const provider = new SavetrixOAuthProvider(config);
    const app = express();
    // One proxy hop (Vercel / most PaaS). Avoids the permissive-trust-proxy
    // error from the rate limiter that a bare `true` triggers.
    app.set("trust proxy", 1);
    // Standard OAuth endpoints: /authorize, /token, /register, and the
    // .well-known metadata documents clients use for discovery.
    app.use(mcpAuthRouter({
        provider,
        issuerUrl,
        resourceServerUrl: resourceUrl,
        scopesSupported: ["mcp"],
        resourceName: "Savetrix",
    }));
    // ── Login page (the /authorize step redirects here) ──
    app.get("/login", async (req, res) => {
        const token = String(req.query.req ?? "");
        if (!token) {
            res.status(400).send("Missing authorization request.");
            return;
        }
        try {
            const loginReq = await provider.readLoginRequest(token);
            const client = await provider.clientsStore.getClient(loginReq.client_id);
            res
                .status(200)
                .type("html")
                .send(loginPage({
                reqToken: token,
                webUrl: config.webUrl,
                clientName: client?.client_name,
            }));
        }
        catch {
            res.status(400).send("This sign-in link has expired. Please start again.");
        }
    });
    app.post("/login", express.urlencoded({ extended: false }), async (req, res) => {
        const token = String(req.body.req ?? "");
        const email = String(req.body.email ?? "");
        const password = String(req.body.password ?? "");
        let loginReq;
        try {
            loginReq = await provider.readLoginRequest(token);
        }
        catch {
            res.status(400).send("This sign-in link has expired. Please start again.");
            return;
        }
        try {
            const code = await provider.issueAuthorizationCode(loginReq, email, password);
            const redirect = new URL(loginReq.redirect_uri);
            redirect.searchParams.set("code", code);
            if (loginReq.state)
                redirect.searchParams.set("state", loginReq.state);
            res.redirect(redirect.toString());
        }
        catch (error) {
            // Structural only (no credentials) — helps distinguish real backend
            // failures from bad-password attempts when debugging via Vercel logs.
            console.error("[savetrix-mcp] /login POST error:", error instanceof Error ? error.message : error);
            const client = await provider.clientsStore.getClient(loginReq.client_id);
            const msg = error instanceof Error ? error.message : String(error);
            let userError;
            if (/credential|login|password|401|incorrect|invalid|unauthorized|wrong/i.test(msg)) {
                userError = "Incorrect email or password. Please try again.";
            }
            else if (/social|google|apple|microsoft|oauth|provider|no.*password|password.*not.*set/i.test(msg)) {
                userError =
                    "This account uses social login (Google / Apple / Microsoft). Please set a password at scantrix.ai/forgot-password, then try again.";
            }
            else if (/timeout|ETIMEDOUT|ECONNRESET|network|ENOTFOUND/i.test(msg)) {
                userError = "Could not reach Scantrix servers. Please check your connection and try again.";
            }
            else {
                userError = "Sign-in failed. Please try again. If this persists, reset your password at scantrix.ai.";
            }
            res
                .status(401)
                .type("html")
                .send(loginPage({
                reqToken: token,
                webUrl: config.webUrl,
                clientName: client?.client_name,
                error: userError,
            }));
        }
    });
    // ── MCP endpoint (bearer-protected, one server per request = stateless) ──
    const bearer = requireBearerAuth({
        verifier: provider,
        requiredScopes: ["mcp"],
        resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(resourceUrl),
    });
    const handleMcp = async (req, res) => {
        const extra = (req.auth?.extra ?? {});
        const { st_at: accessToken, st_rt: refreshToken } = extra;
        if (!accessToken || !refreshToken) {
            res.status(401).json({ error: "invalid_token" });
            return;
        }
        const client = createClientForTokens(config, {
            accessToken,
            refreshToken,
            user: extra.user,
        });
        const server = new McpServer({ name: "savetrix-mcp-server", version: "1.0.0" });
        registerSavetrixTools(server, client, {
            // Claude reaches this server from Anthropic's cloud and can never read a
            // file off the user's device, so the only reliable transport for a local
            // file is a browser upload. Mint a ticket that carries this request's
            // already-verified Savetrix session — the link needs no second login.
            createUploadLink: async () => {
                const ticket = await encryptToken(config.tokenSecret, "upload", {
                    st_at: accessToken,
                    st_rt: refreshToken,
                    email: extra.email,
                    user: extra.user,
                }, UPLOAD_TICKET_TTL);
                return `${config.publicUrl}/upload?t=${encodeURIComponent(ticket)}`;
            },
        });
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
        res.on("close", () => {
            void transport.close();
            void server.close();
        });
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
    };
    app.post("/mcp", bearer, express.json(), handleMcp);
    app.get("/mcp", bearer, handleMcp);
    app.delete("/mcp", bearer, handleMcp);
    // ── Browser invoice upload (ticketed; no OAuth round-trip) ──
    const readTicket = (raw) => decryptToken(config.tokenSecret, "upload", String(raw ?? ""));
    app.get("/upload", async (req, res) => {
        const raw = String(req.query.t ?? "");
        if (!raw) {
            res.status(400).send("Missing upload ticket.");
            return;
        }
        try {
            const ticket = await readTicket(raw);
            res.status(200).type("html").send(uploadPage({
                ticket: raw,
                webUrl: config.webUrl,
                maxBytes: maxBrowserUploadBytes(),
                email: ticket.email,
            }));
        }
        catch {
            res
                .status(400)
                .send("This upload link has expired. Ask Claude for a new upload link.");
        }
    });
    // The page sends the file as the raw request body (not multipart) so no
    // multipart parser dependency is needed here.
    app.post("/upload", express.raw({ type: "*/*", limit: maxBrowserUploadBytes() }), async (req, res) => {
        let ticket;
        try {
            ticket = await readTicket(req.query.t);
        }
        catch {
            res.status(401).json({ message: "This upload link has expired. Ask Claude for a new one." });
            return;
        }
        // Normally express.raw() leaves a Buffer here. Some platforms (Vercel
        // among them) may pre-read the request body before the Express app sees
        // it, in which case req.body arrives already decoded — accept that too
        // rather than reporting an empty upload.
        let bytes;
        if (Buffer.isBuffer(req.body)) {
            bytes = req.body;
        }
        else if (typeof req.body === "string") {
            bytes = Buffer.from(req.body, "binary");
        }
        else {
            bytes = Buffer.alloc(0);
        }
        if (bytes.length === 0) {
            res.status(400).json({ message: "No file data received." });
            return;
        }
        let fileName = "invoice.pdf";
        const headerName = req.get("x-file-name");
        if (headerName) {
            try {
                fileName = decodeURIComponent(headerName);
            }
            catch {
                fileName = headerName;
            }
        }
        // Never let a client-supplied name escape into a path.
        fileName = fileName.replace(/[/\\]/g, "_").slice(0, 200) || "invoice.pdf";
        const contentType = (req.get("content-type") ?? "").split(";")[0].trim();
        try {
            const client = createClientForTokens(config, {
                accessToken: ticket.st_at,
                refreshToken: ticket.st_rt,
                user: ticket.user,
            });
            const result = await uploadInvoiceBytes(client, {
                bytes,
                fileName,
                mimeType: contentType || "application/octet-stream",
            });
            res.status(200).json({ ok: true, result });
        }
        catch (error) {
            console.error("[savetrix-mcp] /upload error:", error instanceof Error ? error.message : error);
            const status = error?.response?.status;
            res.status(status === 401 ? 401 : 502).json({
                message: status === 401
                    ? "Your Scantrix session expired. Ask Claude for a new upload link."
                    : "Scantrix could not accept that file. Please try again.",
            });
        }
    });
    app.get("/healthz", (_req, res) => res.status(200).json({ ok: true }));
    return app;
};
export const startRemote = (config) => {
    const app = createRemoteApp(config);
    app.listen(config.port, () => {
        // eslint-disable-next-line no-console
        console.error(`Savetrix MCP connector (remote/OAuth) listening on :${config.port} — public URL ${config.publicUrl}`);
    });
};
