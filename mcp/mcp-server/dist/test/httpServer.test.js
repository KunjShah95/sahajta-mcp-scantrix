import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../servers/httpServer.js";
const makeConfig = (overrides = {}) => ({
    apiUrl: "https://api.test",
    webUrl: "https://web.test",
    port: 0,
    http: true,
    configFilePath: "does/not/matter.json",
    ...overrides,
});
const initializePayload = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test", version: "0.0.0" },
    },
};
const startServer = (config) => new Promise((resolve) => {
    const app = createApp(config);
    const server = app.listen(config.port ?? 0, "127.0.0.1", () => {
        const address = server.address();
        const port = typeof address === "object" && address ? address.port : 0;
        resolve({
            baseUrl: `http://127.0.0.1:${port}`,
            close: () => new Promise((r) => server.close(() => r())),
        });
    });
});
test("GET /healthz returns ok", async () => {
    const { baseUrl, close } = await startServer(makeConfig());
    try {
        const res = await fetch(`${baseUrl}/healthz`);
        assert.equal(res.status, 200);
        assert.deepEqual(await res.json(), { status: "ok" });
    }
    finally {
        await close();
    }
});
test("POST /mcp handles initialize and tools/list", async () => {
    const { baseUrl, close } = await startServer(makeConfig());
    try {
        const initRes = await fetch(`${baseUrl}/mcp`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
            body: JSON.stringify(initializePayload),
        });
        assert.equal(initRes.status, 200);
        const initBody = await initRes.json();
        assert.equal(initBody.result.serverInfo.name, "savetrix-mcp-server");
        const toolsRes = await fetch(`${baseUrl}/mcp`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: 2,
                method: "tools/list",
            }),
        });
        const toolsBody = await toolsRes.json();
        const names = (toolsBody.result?.tools ?? []).map((t) => t.name);
        assert.ok(names.includes("savetrix_invoice_list"));
        assert.ok(names.includes("savetrix_login"));
    }
    finally {
        await close();
    }
});
test("POST /mcp rejects a request without the API key when configured", async () => {
    const { baseUrl, close } = await startServer(makeConfig({ mcpApiKey: "secret" }));
    try {
        const res = await fetch(`${baseUrl}/mcp`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
            body: JSON.stringify(initializePayload),
        });
        assert.equal(res.status, 401);
        const okRes = await fetch(`${baseUrl}/mcp`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json, text/event-stream",
                Authorization: "Bearer secret",
            },
            body: JSON.stringify(initializePayload),
        });
        assert.equal(okRes.status, 200);
    }
    finally {
        await close();
    }
});
