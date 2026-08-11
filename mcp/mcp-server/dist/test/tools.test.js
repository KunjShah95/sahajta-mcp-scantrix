import { test } from "node:test";
import assert from "node:assert/strict";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { requireConfirm } from "../tools/gates.js";
import { buildServer, registerSavetrixTools } from "../tools/index.js";
import { SavetrixClient } from "../client/savetrixClient.js";
import { MemorySessionStore } from "../session.js";
import * as S from "../tools/schemas.js";
const testConfig = {
    apiUrl: "https://api.test",
    webUrl: "https://web.test",
    port: 8000,
    http: false,
    remote: false,
    configFilePath: "does/not/matter.json",
    allowedHosts: [],
};
/** Every tool as a connected MCP client actually sees it. */
const listTools = async () => {
    const server = buildServer(testConfig);
    const client = new Client({ name: "test", version: "0.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    return (await client.listTools()).tools;
};
/** Advertised input properties for one tool, as a client actually sees them. */
const advertisedProps = async (host) => {
    const client = new SavetrixClient({
        baseURL: "https://api.test",
        session: new MemorySessionStore(),
    });
    const server = new McpServer({ name: "test", version: "0.0.0" });
    registerSavetrixTools(server, client, host);
    const mcpClient = new Client({ name: "test", version: "0.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    const tool = (await mcpClient.listTools()).tools.find((t) => t.name === "savetrix_invoice_upload");
    const schema = tool?.inputSchema;
    return Object.keys(schema?.properties ?? {}).sort();
};
test("requireConfirm rejects without confirm:true and passes with it", () => {
    const denied = requireConfirm({}, "post invoice");
    assert.equal(denied.ok, false);
    assert.match(denied.message, /confirm/);
    const allowed = requireConfirm({ confirm: true }, "post invoice");
    assert.equal(allowed.ok, true);
});
test("buildServer registers the full savetrix tool set", async () => {
    const server = buildServer(testConfig);
    const client = new Client({ name: "test", version: "0.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const listed = await client.listTools();
    const names = listed.tools.map((t) => t.name);
    for (const required of [
        "savetrix_get_started",
        "savetrix_login",
        "savetrix_logout",
        "savetrix_account_info",
        "savetrix_account_update_profile",
        "savetrix_invoice_list",
        "savetrix_invoice_get",
        "savetrix_invoice_upload",
        "savetrix_invoice_upload_link",
        "savetrix_invoice_update",
        "savetrix_invoice_post_to_qb",
        "savetrix_invoice_reject",
        "savetrix_vendor_list",
        "savetrix_vendor_create",
        "savetrix_vendor_update",
        "savetrix_vendor_deactivate",
        "savetrix_vendor_reactivate",
        "savetrix_account_list",
        "savetrix_account_create",
        "savetrix_account_sync",
        "savetrix_taxcode_list",
        "savetrix_taxcode_sync",
        "savetrix_qb_status",
        "savetrix_qb_connections",
        "savetrix_qb_set_active",
        "savetrix_qb_connect",
        "savetrix_qb_disconnect",
        "savetrix_team_list",
        "savetrix_team_invite",
        "savetrix_team_remove",
        "savetrix_subscription_plans",
        "savetrix_subscription_my",
        "savetrix_subscription_choose",
    ]) {
        assert.ok(names.includes(required), `missing tool ${required}`);
    }
});
// Annotations are what a client uses to decide what it may auto-approve and
// what a human has to confirm. This server's requireConfirm gate only reads an
// argument the MODEL supplies, so it is not a human-consent control — if these
// hints go missing, every tool gets gated identically and the genuinely
// dangerous writes stop standing out.
test("every registered tool declares annotations with a readOnlyHint", async () => {
    const tools = await listTools();
    assert.ok(tools.length >= 33, `expected the full tool set, got ${tools.length}`);
    for (const tool of tools) {
        const a = tool.annotations;
        assert.ok(a, `${tool.name} has no annotations`);
        assert.equal(typeof a.readOnlyHint, "boolean", `${tool.name} readOnlyHint`);
        assert.equal(typeof a.destructiveHint, "boolean", `${tool.name} destructiveHint`);
        assert.equal(typeof a.idempotentHint, "boolean", `${tool.name} idempotentHint`);
        assert.equal(typeof a.openWorldHint, "boolean", `${tool.name} openWorldHint`);
        assert.equal(typeof a.title, "string", `${tool.name} annotations.title`);
        assert.ok(a.title.length > 0, `${tool.name} title is empty`);
        assert.equal(tool.title, a.title, `${tool.name} title must match annotations.title`);
        assert.ok(!(a.readOnlyHint && a.destructiveHint), `${tool.name} cannot be both read-only and destructive`);
    }
});
test("tools that overwrite, remove, post or re-bill are annotated destructive", async () => {
    const byName = new Map((await listTools()).map((t) => [t.name, t]));
    // savetrix_team_invite can grant an admin role; savetrix_invoice_update can
    // rewrite totalAmount and bankingDetails. Both are otherwise ungated.
    for (const name of [
        "savetrix_invoice_update",
        "savetrix_invoice_post_to_qb",
        "savetrix_invoice_reject",
        "savetrix_vendor_update",
        "savetrix_vendor_deactivate",
        "savetrix_qb_disconnect",
        "savetrix_team_invite",
        "savetrix_team_remove",
        "savetrix_subscription_choose",
        "savetrix_account_update_profile",
    ]) {
        const a = byName.get(name)?.annotations;
        assert.equal(a?.destructiveHint, true, `${name} must be destructiveHint:true`);
        assert.equal(a?.readOnlyHint, false, `${name} must not be readOnlyHint:true`);
    }
    // …and the pure reads stay auto-approvable.
    for (const name of [
        "savetrix_invoice_list",
        "savetrix_invoice_get",
        "savetrix_vendor_list",
        "savetrix_account_list",
        "savetrix_taxcode_list",
        "savetrix_team_list",
        "savetrix_qb_status",
        "savetrix_qb_connections",
        "savetrix_subscription_plans",
        "savetrix_subscription_my",
        "savetrix_account_info",
    ]) {
        const a = byName.get(name)?.annotations;
        assert.equal(a?.readOnlyHint, true, `${name} must be readOnlyHint:true`);
        assert.equal(a?.destructiveHint, false, `${name} must be destructiveHint:false`);
    }
    // Creating something new is not destructive, but it is not idempotent
    // either — running it twice leaves two records.
    for (const name of ["savetrix_vendor_create", "savetrix_account_create", "savetrix_invoice_upload"]) {
        const a = byName.get(name)?.annotations;
        assert.equal(a?.destructiveHint, false, `${name} destructiveHint`);
        assert.equal(a?.idempotentHint, false, `${name} idempotentHint`);
    }
    // Anything whose effect lands in QuickBooks/Intuit is open-world.
    for (const name of ["savetrix_vendor_list", "savetrix_invoice_post_to_qb", "savetrix_qb_connect"]) {
        assert.equal(byName.get(name)?.annotations?.openWorldHint, true, `${name} openWorldHint`);
    }
});
// The verified production bug: the backend answers HTTP 200 with
// {success:false, message:"QuickBooks token revoked — reconnect required"} and
// the tool reported {"invoices": []} as a SUCCESS, so the model told the user
// they had no invoices. It must now come back as a tool error carrying the
// backend's own message.
test("an upstream 200-with-success:false becomes a tool error, not an empty list", async () => {
    const instance = axios.create();
    const mock = new MockAdapter(instance);
    const client = new SavetrixClient({
        baseURL: "https://api.test",
        session: new MemorySessionStore(),
        axiosInstance: instance,
    });
    client.setTokens("at", "rt");
    mock.onGet("/qb-connections").reply(200, {
        data: { connections: [{ _id: "qb-1", status: "active" }] },
    });
    mock.onGet("/invoices").reply(200, {
        success: false,
        message: "QuickBooks token revoked — reconnect required",
    });
    const server = new McpServer({ name: "test", version: "0.0.0" });
    registerSavetrixTools(server, client, {});
    const mcpClient = new Client({ name: "test", version: "0.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    const result = await mcpClient.callTool({ name: "savetrix_invoice_list", arguments: {} });
    assert.equal(result.isError, true, "a failed upstream call must set isError");
    const body = String(result.content?.[0]?.text ?? "");
    assert.match(body, /QuickBooks token revoked/, "the upstream message must survive");
    assert.doesNotMatch(body, /"invoices"/, "must not look like a list of invoices");
    assert.match(body, /"success": false/);
    mock.restore();
});
test("a genuinely empty invoice list is still a successful, empty result", async () => {
    const instance = axios.create();
    const mock = new MockAdapter(instance);
    const client = new SavetrixClient({
        baseURL: "https://api.test",
        session: new MemorySessionStore(),
        axiosInstance: instance,
    });
    client.setTokens("at", "rt");
    mock.onGet("/qb-connections").reply(200, {
        data: { connections: [{ _id: "qb-1", status: "active" }] },
    });
    mock.onGet("/invoices").reply(200, { data: { invoices: [], pagination: { total: 0 } } });
    const server = new McpServer({ name: "test", version: "0.0.0" });
    registerSavetrixTools(server, client, {});
    const mcpClient = new Client({ name: "test", version: "0.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    const result = await mcpClient.callTool({ name: "savetrix_invoice_list", arguments: {} });
    assert.notEqual(result.isError, true, "an empty list is not an error");
    assert.deepEqual(JSON.parse(result.content[0].text).invoices, []);
    mock.restore();
});
// A body we cannot interpret is also a failure, never "you have no data".
test("an uninterpretable upstream body becomes a tool error", async () => {
    const instance = axios.create();
    const mock = new MockAdapter(instance);
    const client = new SavetrixClient({
        baseURL: "https://api.test",
        session: new MemorySessionStore(),
        axiosInstance: instance,
    });
    client.setTokens("at", "rt");
    mock.onGet("/qb-connections").reply(200, {
        data: { connections: [{ _id: "qb-1", status: "active" }] },
    });
    mock.onGet("/quickbooks/vendors").reply(200, "<html>502 Bad Gateway</html>");
    const server = new McpServer({ name: "test", version: "0.0.0" });
    registerSavetrixTools(server, client, {});
    const mcpClient = new Client({ name: "test", version: "0.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    const result = await mcpClient.callTool({ name: "savetrix_vendor_list", arguments: {} });
    assert.equal(result.isError, true);
    assert.match(String(result.content?.[0]?.text ?? ""), /Could not interpret/);
    mock.restore();
});
// Regression test for a real client-reported bug: savetrix_qb_set_active
// reported success, but the very next call (savetrix_qb_status) kept acting
// on the old company. Root cause — this remote server builds a fresh
// SavetrixClient per HTTP request (see handleMcp in remoteServer.ts), so
// setActiveQbId() on one request's client is discarded before the next
// request even starts; resolveQbId() then re-derives from whichever
// connection the BACKEND flags "active" (connection health, not "what the
// user picked"), ignoring the switch entirely. The fix: every QB-scoped tool
// now accepts an explicit qbConnectionId argument (schemas.ts) that
// applyQbOverride (tools/index.ts) applies before the call — the MODEL, which
// has memory across tool calls in one conversation, carries the selection
// forward instead of the stateless server. This test proves the override
// actually reaches the outbound X-QB-Id header, even though resolveQbId()'s
// own default would resolve to a different company.
test("an explicit qbConnectionId argument overrides the default active company", async () => {
    const instance = axios.create();
    const mock = new MockAdapter(instance);
    const client = new SavetrixClient({
        baseURL: "https://api.test",
        session: new MemorySessionStore(),
        axiosInstance: instance,
    });
    client.setTokens("at", "rt");
    // The backend's own "active" flag points at a DIFFERENT company than the
    // one we're about to explicitly request — if the override didn't work,
    // this is the id that would leak through instead.
    mock.onGet("/qb-connections").reply(200, {
        data: { connections: [{ _id: "qb-backend-default", status: "active" }] },
    });
    let seenQbId;
    mock.onGet("/invoices").reply((config) => {
        seenQbId = config.headers?.["X-QB-Id"];
        return [200, { data: { invoices: [], pagination: {} } }];
    });
    const server = new McpServer({ name: "test", version: "0.0.0" });
    registerSavetrixTools(server, client, {});
    const mcpClient = new Client({ name: "test", version: "0.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    await mcpClient.callTool({
        name: "savetrix_invoice_list",
        arguments: { qbConnectionId: "qb-explicit-override" },
    });
    assert.equal(seenQbId, "qb-explicit-override", "explicit qbConnectionId argument must win over resolveQbId()'s backend-derived default");
    mock.restore();
});
// filePath on the remote connector is an arbitrary read of the connector's
// OWN container (it can never see the user's machine), and that container's
// environment holds SAVETRIX_TOKEN_SECRET. createUploadLink is supplied only
// by remoteServer.ts, so it is what distinguishes the two modes.
test("the remote connector does not advertise filePath on savetrix_invoice_upload", async () => {
    const props = await advertisedProps({
        createUploadLink: async () => "https://connector.test/upload?t=x",
    });
    assert.ok(!props.includes("filePath"), "remote mode must not advertise a container-filesystem read");
    assert.ok(props.includes("fileUrl"), "fileUrl is the remote transport and must survive");
});
test("a local/stdio install still advertises filePath", async () => {
    const props = await advertisedProps({});
    assert.deepEqual(props, ["fileBase64", "fileName", "filePath", "fileUrl", "mimeType", "qbConnectionId"]);
});
// Defense in depth behind encodeURIComponent: that encodes `/` but NOT `.`,
// so an id is only safe if the traversal characters never get that far.
test("id schemas reject traversal-shaped values", () => {
    for (const bad of ["../../users/me", "..", "..%2F..", "a/b", "a\\b", "a?b", "a#b", "a.b", "x".repeat(129), ""]) {
        assert.equal(S.invoiceIdSchema.safeParse({ invoiceId: bad }).success, false, `invoiceId ${bad}`);
        assert.equal(S.vendorIdSchema.safeParse({ vendorId: bad }).success, false, `vendorId ${bad}`);
        assert.equal(S.setActiveSchema.safeParse({ qbConnectionId: bad }).success, false, `qbConnectionId ${bad}`);
        assert.equal(S.removeMemberSchema.safeParse({ memberId: bad, confirm: true }).success, false, `memberId ${bad}`);
        assert.equal(S.invoiceListSchema.safeParse({ qbConnectionId: bad }).success, false, `qbConnectionId override ${bad}`);
    }
});
test("id schemas still accept the id shapes the backend really returns", () => {
    for (const good of ["68b3f2c1a4d5e6f708192a3b", "9341457544400313", "qb-1", "conn_1", "1"]) {
        assert.equal(S.invoiceIdSchema.safeParse({ invoiceId: good }).success, true, good);
        assert.equal(S.setActiveSchema.safeParse({ qbConnectionId: good }).success, true, good);
        assert.equal(S.invoiceListSchema.safeParse({ qbConnectionId: good }).success, true, good);
    }
});
