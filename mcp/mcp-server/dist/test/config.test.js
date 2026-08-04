import { test } from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../config.js";
const SAVETRIX_ENV_KEYS = [
    "SAVETRIX_API_URL",
    "SAVETRIX_PORT",
    "SAVETRIX_EMAIL",
    "SAVETRIX_PASSWORD",
    "SAVETRIX_QB_CONNECTION_ID",
    "SAVETRIX_MCP_API_KEY",
];
const clearEnv = () => {
    for (const k of SAVETRIX_ENV_KEYS)
        delete process.env[k];
};
test("loadConfig applies defaults when nothing is set", () => {
    clearEnv();
    const c = loadConfig([]);
    assert.equal(c.apiUrl, "https://api.savetrix.com/api");
    assert.equal(c.port, 8000);
    assert.equal(c.http, false);
});
test("loadConfig reads env vars", () => {
    clearEnv();
    process.env.SAVETRIX_API_URL = "https://example.test/api";
    process.env.SAVETRIX_PORT = "9100";
    process.env.SAVETRIX_EMAIL = "a@b.test";
    process.env.SAVETRIX_PASSWORD = "pw";
    const c = loadConfig([]);
    assert.equal(c.apiUrl, "https://example.test/api");
    assert.equal(c.port, 9100);
    assert.equal(c.email, "a@b.test");
    assert.equal(c.password, "pw");
});
test("loadConfig CLI flags override env (--http and --port)", () => {
    clearEnv();
    process.env.SAVETRIX_PORT = "9100";
    const c = loadConfig(["--http", "--port", "9999"]);
    assert.equal(c.http, true);
    assert.equal(c.port, 9999);
});
test("loadConfig reads a config file at --config and env overrides file", async () => {
    clearEnv();
    const { mkdtemp, writeFile } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const dir = await mkdtemp(join(tmpdir(), "savetrix-config-"));
    const file = join(dir, "config.json");
    await writeFile(file, JSON.stringify({ email: "file@test.test", qbConnectionId: "qb-1" }));
    process.env.SAVETRIX_EMAIL = "env@test.test";
    const c = loadConfig(["--config", file]);
    assert.equal(c.email, "env@test.test", "env beats file");
    assert.equal(c.qbConnectionId, "qb-1", "file value used when env absent");
    assert.equal(c.configFilePath, file);
});
test("loadConfig rejects an invalid --port", () => {
    clearEnv();
    assert.throws(() => loadConfig(["--port", "not-a-number"]));
});
test("loadConfig accepts email+password pair and rejects partial pair", () => {
    clearEnv();
    const ok = loadConfig([]);
    process.env.SAVETRIX_EMAIL = "a@b.test";
    const bad = loadConfig([]);
    assert.equal(bad.email, "a@b.test");
    assert.equal(bad.password, undefined);
    process.env.SAVETRIX_PASSWORD = "pw";
    const good = loadConfig([]);
    assert.equal(good.email, "a@b.test");
    assert.equal(good.password, "pw");
});
