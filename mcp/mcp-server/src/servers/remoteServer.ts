import express, { type Request, type Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  mcpAuthRouter,
  getOAuthProtectedResourceMetadataUrl,
} from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import type { Config } from "../config.js";
import { createClientForTokens } from "../client/savetrixClient.js";
import { registerSavetrixTools } from "../tools/index.js";
import { SavetrixOAuthProvider } from "../auth/provider.js";
import { loginPage } from "../auth/loginPage.js";

/**
 * Builds the remote connector Express app: an OAuth 2.1 authorization server
 * (so Claude's "Add custom connector" browser flow works) plus the MCP
 * Streamable HTTP endpoint, protected by bearer tokens.
 */
export const createRemoteApp = (config: Config): express.Express => {
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
  app.use(
    mcpAuthRouter({
      provider,
      issuerUrl,
      resourceServerUrl: resourceUrl,
      scopesSupported: ["mcp"],
      resourceName: "Savetrix",
    }),
  );

  // ── Login page (the /authorize step redirects here) ──
  app.get("/login", async (req: Request, res: Response) => {
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
        .send(
          loginPage({
            reqToken: token,
            webUrl: config.webUrl,
            clientName: client?.client_name,
          }),
        );
    } catch {
      res.status(400).send("This sign-in link has expired. Please start again.");
    }
  });

  app.post(
    "/login",
    express.urlencoded({ extended: false }),
    async (req: Request, res: Response) => {
      const token = String(req.body.req ?? "");
      const email = String(req.body.email ?? "");
      const password = String(req.body.password ?? "");
      let loginReq;
      try {
        loginReq = await provider.readLoginRequest(token);
      } catch {
        res.status(400).send("This sign-in link has expired. Please start again.");
        return;
      }
      try {
        const code = await provider.issueAuthorizationCode(loginReq, email, password);
        const redirect = new URL(loginReq.redirect_uri);
        redirect.searchParams.set("code", code);
        if (loginReq.state) redirect.searchParams.set("state", loginReq.state);
        res.redirect(redirect.toString());
      } catch (error) {
        // Structural only (no credentials) — helps distinguish real backend
        // failures from bad-password attempts when debugging via Vercel logs.
        console.error("[savetrix-mcp] /login POST error:", error instanceof Error ? error.message : error);
        const client = await provider.clientsStore.getClient(loginReq.client_id);
        const msg = error instanceof Error ? error.message : String(error);

        let userError: string;
        if (/credential|login|password|401|incorrect|invalid|unauthorized|wrong/i.test(msg)) {
          userError = "Incorrect email or password. Please try again.";
        } else if (/social|google|apple|microsoft|oauth|provider|no.*password|password.*not.*set/i.test(msg)) {
          userError =
            "This account uses social login (Google / Apple / Microsoft). Please set a password at scantrix.ai/forgot-password, then try again.";
        } else if (/timeout|ETIMEDOUT|ECONNRESET|network|ENOTFOUND/i.test(msg)) {
          userError = "Could not reach Scantrix servers. Please check your connection and try again.";
        } else {
          userError = "Sign-in failed. Please try again. If this persists, reset your password at scantrix.ai.";
        }

        res
          .status(401)
          .type("html")
          .send(
            loginPage({
              reqToken: token,
              webUrl: config.webUrl,
              clientName: client?.client_name,
              error: userError,
            }),
          );
      }
    },
  );

  // ── MCP endpoint (bearer-protected, one server per request = stateless) ──
  const bearer = requireBearerAuth({
    verifier: provider,
    requiredScopes: ["mcp"],
    resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(resourceUrl),
  });

  const handleMcp = async (req: Request, res: Response): Promise<void> => {
    const extra = (req.auth?.extra ?? {}) as { st_at?: string; st_rt?: string; user?: unknown };
    if (!extra.st_at || !extra.st_rt) {
      res.status(401).json({ error: "invalid_token" });
      return;
    }
    const client = createClientForTokens(config, {
      accessToken: extra.st_at,
      refreshToken: extra.st_rt,
      user: extra.user,
    });
    const server = new McpServer({ name: "savetrix-mcp-server", version: "1.0.0" });
    registerSavetrixTools(server, client);
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

  app.get("/healthz", (_req, res) => res.status(200).json({ ok: true }));

  return app;
};

export const startRemote = (config: Config): void => {
  const app = createRemoteApp(config);
  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.error(
      `Savetrix MCP connector (remote/OAuth) listening on :${config.port} — public URL ${config.publicUrl}`,
    );
  });
};
