import { test } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { requireConfirm } from "../tools/gates.js";
import { buildServer } from "../tools/index.js";
import type { Config } from "../config.js";

const testConfig: Config = {
  apiUrl: "https://api.test",
  webUrl: "https://web.test",
  port: 8000,
  http: false,
  remote: false,
  configFilePath: "does/not/matter.json",
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
