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
import type { Config } from "../config.js";

const testConfig: Config = {
  apiUrl: "https://api.test",
  webUrl: "https://web.test",
  port: 8000,
  http: false,
  remote: false,
  configFilePath: "does/not/matter.json",
  allowedHosts: [],
};

test("requireConfirm rejects without confirm:true and passes with it", () => {
  const denied = requireConfirm({}, "post invoice");
  assert.equal(denied.ok, false);
  assert.match(denied.message!, /confirm/);
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
  const mock = new MockAdapter(instance as never);
  const client = new SavetrixClient({
    baseURL: "https://api.test",
    session: new MemorySessionStore(),
    axiosInstance: instance as never,
  });
  client.setTokens("at", "rt");

  // The backend's own "active" flag points at a DIFFERENT company than the
  // one we're about to explicitly request — if the override didn't work,
  // this is the id that would leak through instead.
  mock.onGet("/qb-connections").reply(200, {
    data: { connections: [{ _id: "qb-backend-default", status: "active" }] },
  });

  let seenQbId: string | undefined;
  mock.onGet("/invoices").reply((config) => {
    seenQbId = config.headers?.["X-QB-Id"] as string | undefined;
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

  assert.equal(
    seenQbId,
    "qb-explicit-override",
    "explicit qbConnectionId argument must win over resolveQbId()'s backend-derived default",
  );
  mock.restore();
});
