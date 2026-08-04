import { test } from "node:test";
import assert from "node:assert/strict";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SavetrixClient } from "../client/savetrixClient.js";
import { SessionStore } from "../session.js";
import { unwrapList, unwrapOne, getPagination, } from "../client/unwrap.js";
import { uploadInvoice } from "../client/invoices.js";
const makeSession = async () => {
    const dir = await mkdtemp(join(tmpdir(), "savetrix-client-"));
    return new SessionStore(join(dir, "session.json"));
};
test("unwrapList normalizes data.data.invoices / data.items / plain arrays", () => {
    assert.equal(unwrapList({ data: { data: { invoices: [{ _id: "1" }] } } }, ["invoices"]).length, 1);
    assert.equal(unwrapList({ data: { data: { items: [1] } } }, ["invoices", "items"]).length, 1);
    assert.equal(unwrapList({ data: [1, 2] }, ["invoices"]).length, 2);
    assert.equal(unwrapList({ data: { data: {} } }, ["invoices"]).length, 0);
});
test("unwrapOne returns data.data.invoice then falls back to data", () => {
    assert.deepEqual(unwrapOne({ data: { data: { invoice: { a: 1 } } } }, ["invoice"]), { a: 1 });
    assert.deepEqual(unwrapOne({ data: { x: 2 } }, ["invoice"]), { x: 2 });
});
test("getPagination returns pagination object or undefined", () => {
    assert.deepEqual(getPagination({ data: { data: { pagination: { page: 1 } } } }), { page: 1 });
    assert.equal(getPagination({ data: { data: {} } }), undefined);
});
test("client attaches Bearer token and X-QB-Id headers", async () => {
    const instance = axios.create();
    const mock = new MockAdapter(instance);
    const client = new SavetrixClient({
        baseURL: "https://api.test",
        session: await makeSession(),
        axiosInstance: instance,
    });
    client.setTokens("at", "rt");
    client.setActiveQbId("qb-9");
    mock.onGet("/invoices").reply((config) => {
        assert.equal(config.headers?.Authorization, "Bearer at");
        assert.equal(config.headers?.["X-QB-Id"], "qb-9");
        return [200, { data: { invoices: [], pagination: {} } }];
    });
    await client.api.get("/invoices");
    mock.restore();
});
test("client refreshes access token once on 401 and retries", async () => {
    const instance = axios.create();
    const mock = new MockAdapter(instance);
    const client = new SavetrixClient({
        baseURL: "https://api.test",
        session: await makeSession(),
        axiosInstance: instance,
    });
    client.setTokens("expired", "rt-1");
    mock.onPost("/auth/refresh-token").reply(200, { accessToken: "fresh" });
    mock.onGet("/invoices").replyOnce(401, { message: "expired" });
    mock.onGet("/invoices").replyOnce((config) => {
        assert.equal(config.headers?.Authorization, "Bearer fresh");
        return [200, { data: { invoices: [], pagination: {} } }];
    });
    await client.api.get("/invoices");
    assert.equal(client.getAccessToken(), "fresh");
    mock.restore();
});
test("client surfaces a clear error when refresh fails", async () => {
    const instance = axios.create();
    const mock = new MockAdapter(instance);
    const client = new SavetrixClient({
        baseURL: "https://api.test",
        session: await makeSession(),
        axiosInstance: instance,
    });
    client.setTokens("expired", "rt-dead");
    mock.onPost("/auth/refresh-token").reply(401, {});
    mock.onGet("/invoices").replyOnce(401, {});
    await assert.rejects(client.api.get("/invoices"), /session.*expired|login/i);
    mock.restore();
});
test("client login saves tokens and returns unwrapped payload", async () => {
    const instance = axios.create();
    const mock = new MockAdapter(instance);
    const client = new SavetrixClient({
        baseURL: "https://api.test",
        session: await makeSession(),
        axiosInstance: instance,
    });
    mock.onPost("/auth/login").reply(200, {
        data: { accessToken: "at1", refreshToken: "rt1", user: { _id: "u1" } },
    });
    const result = await client.login("a@b.test", "pw");
    assert.equal(result.data.accessToken, "at1");
    assert.equal(client.getAccessToken(), "at1");
    assert.equal(client.getRefreshToken(), "rt1");
    mock.restore();
});
test("client logout calls the backend and clears tokens", async () => {
    const instance = axios.create();
    const mock = new MockAdapter(instance);
    const client = new SavetrixClient({
        baseURL: "https://api.test",
        session: await makeSession(),
        axiosInstance: instance,
    });
    client.setTokens("at", "rt");
    mock.onPost("/auth/logout").reply(200, { success: true });
    await client.logout();
    assert.equal(client.getAccessToken(), undefined);
    mock.restore();
});
test("invoice upload accepts inline base64 when the MCP server cannot access the client path", async () => {
    const instance = axios.create();
    const mock = new MockAdapter(instance);
    const client = new SavetrixClient({
        baseURL: "https://api.test",
        session: await makeSession(),
        axiosInstance: instance,
    });
    client.setTokens("at", "rt");
    mock.onPost("/invoices").reply((config) => {
        assert.match(String(config.headers?.["Content-Type"]), /^multipart\/form-data; boundary=/);
        assert.match(config.data.getBuffer().toString("utf8"), /invoice\.pdf/);
        return [200, { success: true }];
    });
    const result = await uploadInvoice(client, {
        fileBase64: Buffer.from("test pdf bytes").toString("base64"),
        fileName: "invoice.pdf",
    });
    assert.deepEqual(result, { success: true });
    mock.restore();
});
