import { test } from "node:test";
import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";
import { createRemoteApp } from "../servers/remoteServer.js";
import { encryptToken } from "../auth/tokens.js";
import type { Config } from "../config.js";

const TOKEN_SECRET = "test-secret-that-is-at-least-32-chars-long";

const makeConfig = (overrides: Partial<Config> = {}): Config => ({
  apiUrl: "https://api.test",
  webUrl: "https://web.test",
  port: 0,
  http: true,
  remote: true,
  configFilePath: "does/not/matter.json",
  publicUrl: "https://connector.test",
  allowedHosts: [],
  tokenSecret: TOKEN_SECRET,
  ...overrides,
});

const startServer = (
  config: Config,
): Promise<{ baseUrl: string; close: () => Promise<void> }> =>
  new Promise((resolve) => {
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

/**
 * Issue a request with an explicit Host header. Node's fetch() treats Host as
 * a forbidden header and silently drops it, which would make every host-aware
 * assertion below pass vacuously against the canonical host.
 */
const withHost = (
  baseUrl: string,
  path: string,
  host: string,
  init: { method?: string; headers?: Record<string, string>; body?: string } = {},
): Promise<{ status: number; header: (n: string) => string | undefined; json: () => any }> =>
  new Promise((resolve, reject) => {
    const target = new URL(path, baseUrl);
    const req = httpRequest(
      {
        hostname: target.hostname,
        port: target.port,
        path: `${target.pathname}${target.search}`,
        method: init.method ?? "GET",
        headers: { Host: host, ...(init.headers ?? {}) },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 0,
            header: (n) => {
              const v = res.headers[n.toLowerCase()];
              return Array.isArray(v) ? v.join(", ") : v;
            },
            json: () => JSON.parse(body),
          }),
        );
      },
    );
    req.on("error", reject);
    if (init.body) req.write(init.body);
    req.end();
  });

const makeTicket = (): Promise<string> =>
  encryptToken(
    TOKEN_SECRET,
    "upload",
    { st_at: "access", st_rt: "refresh", email: "client@scantrix.ai" },
    600,
  );

test("the connector advertises /mcp as the protected resource", async () => {
  const { baseUrl, close } = await startServer(makeConfig());
  try {
    const res = await fetch(`${baseUrl}/.well-known/oauth-protected-resource/mcp`);
    assert.equal(res.status, 200);
    const body: any = await res.json();
    assert.equal(body.resource, "https://connector.test/mcp");
  } finally {
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
  } finally {
    await close();
  }
});

test("GET /upload refuses a missing or forged ticket", async () => {
  const { baseUrl, close } = await startServer(makeConfig());
  try {
    assert.equal((await fetch(`${baseUrl}/upload`)).status, 400);
    assert.equal((await fetch(`${baseUrl}/upload?t=not-a-real-ticket`)).status, 400);
    // A ticket signed with a different secret must not be accepted.
    const foreign = await encryptToken(
      "some-other-secret-that-is-32-chars-long!",
      "upload",
      { st_at: "a", st_rt: "b" },
      600,
    );
    assert.equal((await fetch(`${baseUrl}/upload?t=${encodeURIComponent(foreign)}`)).status, 400);
  } finally {
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
    assert.match(String((await empty.json() as any).message), /No file data/);
  } finally {
    await close();
  }
});

test("POST /upload accepts raw bytes and reports a backend failure cleanly", async () => {
  // apiUrl points at a host that cannot resolve, so the forward to /invoices
  // fails — proving the route parsed the raw body and reached the API call
  // rather than 404ing or choking on the missing multipart parser.
  const { baseUrl, close } = await startServer(
    makeConfig({ apiUrl: "http://127.0.0.1:1/api" }),
  );
  try {
    const res = await fetch(`${baseUrl}/upload?t=${encodeURIComponent(await makeTicket())}`, {
      method: "POST",
      headers: { "Content-Type": "application/pdf", "X-File-Name": "bill%2042.pdf" },
      body: Buffer.from("%PDF-1.7 fake invoice bytes"),
    });
    assert.equal(res.status, 502);
    assert.match(String((await res.json() as any).message), /could not accept that file/i);
  } finally {
    await close();
  }
});

// A deployment kept on an old alias during a domain migration must advertise
// that alias as the resource, not the canonical host. Serving the canonical
// identity to a request on the alias is the RFC 9728 mismatch a validating
// client rejects as "no MCP server found at the provided URL".
test("an allowlisted alias host advertises itself as issuer and resource", async () => {
  const { baseUrl, close } = await startServer(
    makeConfig({ allowedHosts: ["old-alias.vercel.app"] }),
  );
  try {
    const meta = (
      await withHost(baseUrl, "/.well-known/oauth-protected-resource/mcp", "old-alias.vercel.app")
    ).json();
    assert.equal(meta.resource, "https://old-alias.vercel.app/mcp");
    assert.deepEqual(meta.authorization_servers, ["https://old-alias.vercel.app/"]);

    const as = (
      await withHost(baseUrl, "/.well-known/oauth-authorization-server", "old-alias.vercel.app")
    ).json();
    assert.equal(as.issuer, "https://old-alias.vercel.app/");
    assert.equal(as.token_endpoint, "https://old-alias.vercel.app/token");
    assert.equal(as.registration_endpoint, "https://old-alias.vercel.app/register");

    // The 401 pointer must agree with the documents above.
    const res = await withHost(baseUrl, "/mcp", "old-alias.vercel.app", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    assert.equal(res.status, 401);
    assert.match(
      String(res.header("www-authenticate")),
      /resource_metadata="https:\/\/old-alias\.vercel\.app\/\.well-known\/oauth-protected-resource\/mcp"/,
    );
  } finally {
    await close();
  }
});

test("a host that is not allowlisted cannot redirect discovery at itself", async () => {
  const { baseUrl, close } = await startServer(
    makeConfig({ allowedHosts: ["old-alias.vercel.app"] }),
  );
  try {
    // Host-header spoofing must not make us hand a client metadata pointing
    // its /token calls at an origin we don't control.
    for (const forged of ["evil.example", "connector.test.evil.example"]) {
      const meta = (
        await withHost(baseUrl, "/.well-known/oauth-protected-resource/mcp", forged)
      ).json();
      assert.equal(meta.resource, "https://connector.test/mcp", `forged host ${forged}`);
    }
  } finally {
    await close();
  }
});

test("the canonical host keeps advertising the canonical identity", async () => {
  const { baseUrl, close } = await startServer(
    makeConfig({ allowedHosts: ["old-alias.vercel.app"] }),
  );
  try {
    const meta = (
      await withHost(baseUrl, "/.well-known/oauth-protected-resource/mcp", "connector.test")
    ).json();
    assert.equal(meta.resource, "https://connector.test/mcp");
  } finally {
    await close();
  }
});

test("the remote connector refuses to boot without a token secret", () => {
  assert.throws(
    () => createRemoteApp(makeConfig({ tokenSecret: "too-short" })),
    /SAVETRIX_TOKEN_SECRET/,
  );
  assert.throws(
    () => createRemoteApp(makeConfig({ publicUrl: undefined })),
    /SAVETRIX_PUBLIC_URL/,
  );
});
