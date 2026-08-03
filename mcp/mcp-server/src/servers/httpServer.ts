import express, { Express, NextFunction, Request, Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Config } from "../config.js";
import { buildServer } from "../tools/index.js";

export const createApp = (config: Config): Express => {
  const app = express();
  app.use(express.json());

  app.get("/healthz", (_req, res) => {
    res.json({ status: "ok" });
  });

  const apiKey = config.mcpApiKey;
  const requireApiKey = (req: Request, res: Response, next: NextFunction) => {
    if (!apiKey) return next();
    const provided = req.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
    if (provided !== apiKey) {
      res.status(401).json({ jsonrpc: "2.0", error: { code: -32001, message: "Unauthorized" }, id: null });
      return;
    }
    next();
  };

  app.post("/mcp", requireApiKey, async (req: Request, res: Response) => {
    try {
      const server = buildServer(config);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      res.on("close", () => {
        transport.close();
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("MCP request failed:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: req.body?.id ?? null,
        });
      }
    }
  });

  return app;
};

export const runHttp = async (config: Config): Promise<void> => {
  const app = createApp(config);
  await new Promise<void>((resolve) => {
    app.listen(config.port, () => resolve());
  });
  console.error(`Savetrix MCP server listening on http://0.0.0.0:${config.port}/mcp`);
};
