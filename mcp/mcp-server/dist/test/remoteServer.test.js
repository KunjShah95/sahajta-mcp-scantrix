import { test } from "node:test";
import assert from "node:assert/strict";
import { createRemoteApp } from "../servers/remoteServer.js";
import { encryptToken } from "../auth/tokens.js";
const TOKEN_SECRET = "test-secret-that-is-at-least-32-chars-long";
const makeConfig = (overrides = {}) => ({
    apiUrl: "https://api.test",
    webUrl: "https://web.test",
    port: 0,
    http: true,
    remote: true,
    configFilePath: "does/not/matter.json",
    publicUrl: "https://connector.test",
    tokenSecret: TOKEN_SECRET,
    ...overrides,
});
const startServer = (config) => new Promise((resolve) => {
    const app = createRemoteApp(config);
    const server = app.listen(0, "127.0.0.1", () => {
        const address = server.address();
        const port = typeof address === "object" && address ? address.port : 0;
        resolve({
            baseUrl: `http://127.0.0.1:${port}`,
            close: () => new Promise((r) => server.close(() => r())),
        });
    });
});
const makeTicket = () => encryptToken(TOKEN_SECRET, "upload", { st_at: "access", st_rt: "refresh", email: "client@scantrix.ai" }, 600);
test("the connector advertises /mcp as the protected resource", async () => {
    const { baseUrl, close } = await startServer(makeConfig());
    try {
        const res = await fetch(`${baseUrl}/.well-known/oauth-protected-resource/mcp`);
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.resource, "https://connector.test/mcp");
    }
    finally {
        await close();
    }
});
test("GET /upload renders the upload page for a valid ticket", async () => {
    const { baseUrl, close } = await startServer(makeConfig());
    try {
        const res = await fetch(`${baseUrl}/upload?t=${encodeURIComponent(await makeTicket())}`);
        assert.equal(res.status, 200);
        const html = await res.text();
        assert.match(html, /Upload an invoice/);
        // The signed-in account is surfaced so the user can tell which account
        // the file lands in before uploading.
        assert.match(html, /client@scantrix\.ai/);
    }
    finally {
        await close();
    }
});
test("GET /upload refuses a missing or forged ticket", async () => {
    const { baseUrl, close } = await startServer(makeConfig());
    try {
        assert.equal((await fetch(`${baseUrl}/upload`)).status, 400);
        assert.equal((await fetch(`${baseUrl}/upload?t=not-a-real-ticket`)).status, 400);
        // A ticket signed with a different secret must not be accepted.
        const foreign = await encryptToken("some-other-secret-that-is-32-chars-long!", "upload", { st_at: "a", st_rt: "b" }, 600);
        assert.equal((await fetch(`${baseUrl}/upload?t=${encodeURIComponent(foreign)}`)).status, 400);
    }
    finally {
        await close();
    }
});
test("POST /upload rejects an expired ticket and an empty body", async () => {
    const { baseUrl, close } = await startServer(makeConfig());
    try {
        const bad = await fetch(`${baseUrl}/upload?t=nope`, {
            method: "POST",
            headers: { "Content-Type": "application/pdf" },
            body: "x",
        });
        assert.equal(bad.status, 401);
        const empty = await fetch(`${baseUrl}/upload?t=${encodeURIComponent(await makeTicket())}`, {
            method: "POST",
            headers: { "Content-Type": "application/pdf" },
            body: new Uint8Array(0),
        });
        assert.equal(empty.status, 400);
        assert.match(String((await empty.json()).message), /No file data/);
    }
    finally {
        await close();
    }
});
test("POST /upload accepts raw bytes and reports a backend failure cleanly", async () => {
    // apiUrl points at a host that cannot resolve, so the forward to /invoices
    // fails — proving the route parsed the raw body and reached the API call
    // rather than 404ing or choking on the missing multipart parser.
    const { baseUrl, close } = await startServer(makeConfig({ apiUrl: "http://127.0.0.1:1/api" }));
    try {
        const res = await fetch(`${baseUrl}/upload?t=${encodeURIComponent(await makeTicket())}`, {
            method: "POST",
            headers: { "Content-Type": "application/pdf", "X-File-Name": "bill%2042.pdf" },
            body: Buffer.from("%PDF-1.7 fake invoice bytes"),
        });
        assert.equal(res.status, 502);
        assert.match(String((await res.json()).message), /could not accept that file/i);
    }
    finally {
        await close();
    }
});
test("the remote connector refuses to boot without a token secret", () => {
    assert.throws(() => createRemoteApp(makeConfig({ tokenSecret: "too-short" })), /SAVETRIX_TOKEN_SECRET/);
    assert.throws(() => createRemoteApp(makeConfig({ publicUrl: undefined })), /SAVETRIX_PUBLIC_URL/);
});
