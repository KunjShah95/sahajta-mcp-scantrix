// Tests for the chatbot's write tools (src/lib/chatbot/tools.ts).
//
// Verifies that write tool functions hit the correct REST endpoints with the
// right method + body, that the confirm gate blocks destructive actions
// until confirm=true is passed (mirroring the MCP server's gates.ts
// pattern), that required fields are validated before any network call, and
// that responses are shrunk through the same chat-context mappers the read
// tools already use rather than forwarded raw.
//
// Run with: npm test   (node --import tsx --test src/test/*.test.ts)
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import axios from "axios";

import {
  callTool,
  createGLAccount,
  createVendor,
  deactivateVendor,
  postInvoiceToQuickBooks,
  reactivateVendor,
  rejectInvoice,
  requireConfirm,
  syncGLAccounts,
  syncTaxCodes,
  updateInvoice,
  updateVendor,
  TOOL_NAMES,
  type PostInvoiceToQbArgs,
  type ToolName,
} from "../lib/chatbot/tools";

const ACCESS_TOKEN = "test-access-token";
const QB_CONNECTION_ID = "qb-conn-123";

// Every write tool returns Promise<unknown> (see callTool's signature) — this
// is a loose shape covering every field any test below asserts on, purely so
// assertions don't need `any`.
interface ToolResult {
  id?: string;
  success?: boolean;
  message?: string;
  confirmationRequired?: boolean;
  status?: string;
  displayName?: string;
  vendor?: string;
  name?: string;
  error?: string;
}

// Save originals so we never leak mocks between tests (axios is a shared
// singleton module — polluting it would break other tests in the same process).
const originalGet = axios.get;
const originalPost = axios.post;
const originalPatch = axios.patch;
const originalDelete = axios.delete;

afterEach(() => {
  axios.get = originalGet;
  axios.post = originalPost;
  axios.patch = originalPatch;
  axios.delete = originalDelete;
});

/** Stub an axios method with a tracking function that records all calls. */
function stubAxios(method: "get" | "post" | "patch" | "delete", response: unknown) {
  const calls: unknown[][] = [];
  (axios as unknown as Record<string, unknown>)[method] = (...args: unknown[]) => {
    calls.push(args);
    return Promise.resolve(response);
  };
  return { mock: { calls } };
}

describe("requireConfirm", () => {
  it("returns ok:false when confirm is false", () => {
    const result = requireConfirm({ confirm: false }, "post invoice to QuickBooks");
    assert.equal(result.ok, false);
    assert.ok(result.message?.includes("post invoice to QuickBooks"));
  });

  it("returns ok:false when confirm is missing", () => {
    const result = requireConfirm({}, "reject invoice");
    assert.equal(result.ok, false);
    assert.ok(result.message?.includes("reject invoice"));
  });

  it("returns ok:true when confirm is true", () => {
    const result = requireConfirm({ confirm: true }, "deactivate vendor");
    assert.equal(result.ok, true);
    assert.equal(result.message, undefined);
  });
});

describe("update_invoice (PATCH /invoices/:id)", () => {
  it("sends PATCH to /invoices/:id with extractedData body, shrunk through the chat context", async () => {
    const stub = stubAxios("patch", {
      data: { data: { invoice: { _id: "inv-1", postedStatus: "pending", extractedData: { vendorName: "Acme Corp", totalAmount: 1500 } } } },
    });

    const result = await updateInvoice(ACCESS_TOKEN, QB_CONNECTION_ID, {
      invoiceId: "inv-1",
      extractedData: { vendorName: "Acme Corp", totalAmount: 1500 },
    });

    const [path, body, config] = stub.mock.calls[0] as [string, Record<string, unknown>, { headers: Record<string, string> }];
    assert.equal(path, "/invoices/inv-1");
    assert.deepEqual(body, { extractedData: { vendorName: "Acme Corp", totalAmount: 1500 } });
    assert.equal(config.headers.Authorization, `Bearer ${ACCESS_TOKEN}`);
    assert.equal(config.headers["X-QB-Id"], QB_CONNECTION_ID);
    // Shrunk through toInvoiceDetailChatContext, not the raw backend record —
    // never a raw pass-through of internal fields (architecture doc §4.5).
    assert.equal((result as ToolResult).id, "inv-1");
    assert.equal((result as ToolResult).vendor, "Acme Corp");
  });

  it("works through callTool dispatcher", async () => {
    const stub = stubAxios("patch", { data: { data: { invoice: { _id: "inv-1" } } } });

    const result = await callTool(
      "update_invoice",
      { invoiceId: "inv-1", extractedData: { glAccountId: "acct-1" } },
      ACCESS_TOKEN,
      QB_CONNECTION_ID,
    );

    assert.equal((result as ToolResult).id, "inv-1");
    const [path] = stub.mock.calls[0] as [string];
    assert.equal(path, "/invoices/inv-1");
  });

  it("rejects a missing invoiceId before making any network call", async () => {
    const stub = stubAxios("patch", { data: {} });
    const result = (await updateInvoice(ACCESS_TOKEN, QB_CONNECTION_ID, {
      invoiceId: "",
      extractedData: {},
    })) as ToolResult;
    assert.equal(result.success, false);
    assert.match(result.message ?? "", /invoiceId/);
    assert.equal(stub.mock.calls.length, 0);
  });
});

describe("post_invoice_to_qb (PATCH /invoices/:id — destructive)", () => {
  it("returns confirmationRequired when confirm is false", async () => {
    const result = (await postInvoiceToQuickBooks(ACCESS_TOKEN, QB_CONNECTION_ID, {
      invoiceId: "inv-1",
      vendorId: "v-1",
      extractedData: { vendorName: "Acme" },
      confirm: false,
    })) as ToolResult;

    assert.equal(result.success, false);
    assert.equal(result.confirmationRequired, true);
    assert.ok(result.message?.includes("confirm"));
  });

  it("returns confirmationRequired when confirm is missing", async () => {
    const result = (await postInvoiceToQuickBooks(ACCESS_TOKEN, QB_CONNECTION_ID, {
      invoiceId: "inv-1",
      vendorId: "v-1",
      extractedData: { vendorName: "Acme" },
      // confirm deliberately omitted — a real caller could send this even
      // though the type requires it, and the gate must still catch it.
    } as unknown as PostInvoiceToQbArgs)) as ToolResult;

    assert.equal(result.success, false);
    assert.equal(result.confirmationRequired, true);
  });

  it("does not call the API when confirm is false", async () => {
    const stub = stubAxios("patch", { data: {} });

    await postInvoiceToQuickBooks(ACCESS_TOKEN, QB_CONNECTION_ID, {
      invoiceId: "inv-1",
      vendorId: "v-1",
      extractedData: {},
      confirm: false,
    });

    assert.equal(stub.mock.calls.length, 0, "API should not be called without confirmation");
  });

  it("sends PATCH with postedStatus:manual when confirm=true", async () => {
    const stub = stubAxios("patch", { data: { data: { invoice: { _id: "inv-1", postedStatus: "manual" } } } });

    const result = await postInvoiceToQuickBooks(ACCESS_TOKEN, QB_CONNECTION_ID, {
      invoiceId: "inv-1",
      vendorId: "v-1",
      extractedData: { vendorName: "Acme", totalAmount: 999 },
      confirm: true,
    });

    const [path, body, config] = stub.mock.calls[0] as [string, Record<string, unknown>, { headers: Record<string, string> }];
    assert.equal(path, "/invoices/inv-1");
    assert.deepEqual(body, {
      vendorId: "v-1",
      postedStatus: "manual",
      extractedData: { vendorName: "Acme", totalAmount: 999 },
    });
    assert.equal(config.headers.Authorization, `Bearer ${ACCESS_TOKEN}`);
    assert.equal(config.headers["X-QB-Id"], QB_CONNECTION_ID);
    assert.equal((result as ToolResult).id, "inv-1");
    assert.equal((result as ToolResult).status, "manual");
  });

  it("rejects a missing vendorId even when confirmed", async () => {
    const stub = stubAxios("patch", { data: {} });
    const result = (await postInvoiceToQuickBooks(ACCESS_TOKEN, QB_CONNECTION_ID, {
      invoiceId: "inv-1",
      vendorId: "",
      extractedData: {},
      confirm: true,
    })) as ToolResult;
    assert.equal(result.success, false);
    assert.match(result.message ?? "", /vendorId/);
    assert.equal(stub.mock.calls.length, 0);
  });
});

describe("reject_invoice (PATCH /invoices/:id — destructive)", () => {
  it("returns confirmationRequired when confirm is false", async () => {
    const result = (await rejectInvoice(ACCESS_TOKEN, QB_CONNECTION_ID, {
      invoiceId: "inv-1",
      reason: "duplicate",
      confirm: false,
    })) as ToolResult;

    assert.equal(result.success, false);
    assert.equal(result.confirmationRequired, true);
  });

  it("sends PATCH with postedStatus:failed + reason when confirm=true", async () => {
    const stub = stubAxios("patch", { data: { data: { invoice: { _id: "inv-1", postedStatus: "failed" } } } });

    const result = await rejectInvoice(ACCESS_TOKEN, QB_CONNECTION_ID, {
      invoiceId: "inv-1",
      reason: "bad scan",
      confirm: true,
    });

    const [path, body] = stub.mock.calls[0] as [string, Record<string, unknown>];
    assert.equal(path, "/invoices/inv-1");
    assert.deepEqual(body, { postedStatus: "failed", reason: "bad scan" });
    assert.equal((result as ToolResult).id, "inv-1");
  });

  it("omits reason when not provided", async () => {
    const stub = stubAxios("patch", { data: { data: { invoice: { _id: "inv-1" } } } });

    await rejectInvoice(ACCESS_TOKEN, QB_CONNECTION_ID, {
      invoiceId: "inv-1",
      confirm: true,
    });

    const [, body] = stub.mock.calls[0] as [string, Record<string, unknown>];
    assert.deepEqual(body, { postedStatus: "failed" });
    assert.equal((body as Record<string, unknown>).reason, undefined);
  });
});

describe("create_vendor (POST /quickbooks/vendors)", () => {
  it("sends POST with required + optional fields, shrunk through the chat context", async () => {
    const stub = stubAxios("post", {
      data: { data: { vendor: { _id: "v-1", displayName: "Acme Ltd", currency: "USD", email: "acme@example.com" } } },
    });

    const result = await createVendor(ACCESS_TOKEN, QB_CONNECTION_ID, {
      displayName: "Acme Ltd",
      currency: "USD",
      glAccountId: "gl-1",
      email: "acme@example.com",
    });

    const [path, body, config] = stub.mock.calls[0] as [string, Record<string, unknown>, { headers: Record<string, string> }];
    assert.equal(path, "/quickbooks/vendors");
    assert.equal(body.displayName, "Acme Ltd");
    assert.equal(body.currency, "USD");
    assert.equal(body.glAccountId, "gl-1");
    assert.equal(body.taxCodeId, "");
    assert.equal(body.email, "acme@example.com");
    assert.equal(body.phone, undefined);
    assert.equal(config.headers["X-QB-Id"], QB_CONNECTION_ID);
    assert.equal((result as ToolResult).id, "v-1");
    assert.equal((result as ToolResult).displayName, "Acme Ltd");
  });

  it("rejects a missing displayName/currency before any network call", async () => {
    const stub = stubAxios("post", { data: {} });
    const result = (await createVendor(ACCESS_TOKEN, QB_CONNECTION_ID, {
      displayName: "",
      currency: "",
      glAccountId: "gl-1",
    })) as ToolResult;
    assert.equal(result.success, false);
    assert.match(result.message ?? "", /displayName/);
    assert.match(result.message ?? "", /currency/);
    assert.equal(stub.mock.calls.length, 0);
  });

  it("rejects a missing glAccountId before any network call — QuickBooks requires one for creation", async () => {
    const stub = stubAxios("post", { data: {} });
    const result = (await createVendor(ACCESS_TOKEN, QB_CONNECTION_ID, {
      displayName: "Acme Ltd",
      currency: "USD",
      glAccountId: "",
    })) as ToolResult;
    assert.equal(result.success, false);
    assert.match(result.message ?? "", /glAccountId/);
    assert.equal(stub.mock.calls.length, 0);
  });
});

describe("update_vendor (PATCH /quickbooks/vendors/:id)", () => {
  it("sends PATCH with only the provided fields", async () => {
    const stub = stubAxios("patch", { data: { data: { vendor: { _id: "v-1", email: "new@example.com" } } } });

    await updateVendor(ACCESS_TOKEN, QB_CONNECTION_ID, {
      vendorId: "v-1",
      email: "new@example.com",
      phone: "555-1234",
    });

    const [path, body] = stub.mock.calls[0] as [string, Record<string, unknown>];
    assert.equal(path, "/quickbooks/vendors/v-1");
    assert.deepEqual(body, { email: "new@example.com", phone: "555-1234" });
  });

  it("excludes undefined fields from the body", async () => {
    const stub = stubAxios("patch", { data: { data: { vendor: { _id: "v-1" } } } });

    await updateVendor(ACCESS_TOKEN, QB_CONNECTION_ID, {
      vendorId: "v-1",
      displayName: "New Name",
    });

    const [, body] = stub.mock.calls[0] as [string, Record<string, unknown>];
    assert.equal(Object.keys(body).length, 1);
    assert.deepEqual(body, { displayName: "New Name" });
  });
});

describe("deactivate_vendor (DELETE /quickbooks/vendors/:id — destructive)", () => {
  it("returns confirmationRequired when confirm is false", async () => {
    const result = (await deactivateVendor(ACCESS_TOKEN, QB_CONNECTION_ID, {
      vendorId: "v-1",
      confirm: false,
    })) as ToolResult;

    assert.equal(result.success, false);
    assert.equal(result.confirmationRequired, true);
  });

  it("does not call the API when confirm is false", async () => {
    const stub = stubAxios("delete", { data: {} });

    await deactivateVendor(ACCESS_TOKEN, QB_CONNECTION_ID, {
      vendorId: "v-1",
      confirm: false,
    });

    assert.equal(stub.mock.calls.length, 0, "API should not be called without confirmation");
  });

  it("sends DELETE when confirm=true", async () => {
    const stub = stubAxios("delete", { data: { data: { success: true } } });

    const result = await deactivateVendor(ACCESS_TOKEN, QB_CONNECTION_ID, {
      vendorId: "v-1",
      confirm: true,
    });

    const [path, config] = stub.mock.calls[0] as [string, { headers: Record<string, string> }];
    assert.equal(path, "/quickbooks/vendors/v-1");
    assert.equal(config.headers["X-QB-Id"], QB_CONNECTION_ID);
    assert.equal((result as ToolResult).success, true);
    assert.equal((result as ToolResult).status, "inactive");
  });
});

describe("reactivate_vendor (POST /quickbooks/vendors/:id/reactivate)", () => {
  it("sends POST with empty body", async () => {
    const stub = stubAxios("post", { data: { data: { vendor: { _id: "v-1", displayName: "Acme", status: "active" } } } });

    const result = await reactivateVendor(ACCESS_TOKEN, QB_CONNECTION_ID, { vendorId: "v-1" });

    const [path, body, config] = stub.mock.calls[0] as [string, Record<string, unknown>, { headers: Record<string, string> }];
    assert.equal(path, "/quickbooks/vendors/v-1/reactivate");
    assert.deepEqual(body, {});
    assert.equal(config.headers["X-QB-Id"], QB_CONNECTION_ID);
    assert.equal((result as ToolResult).id, "v-1");
  });
});

describe("create_gl_account (POST /quickbooks/accounts)", () => {
  it("sends POST with name and accountType, shrunk through the chat context", async () => {
    const stub = stubAxios("post", {
      data: { data: { account: { _id: "a-1", name: "Office Supplies", accountType: "Expense", accountSubType: "Supplies" } } },
    });

    const result = await createGLAccount(ACCESS_TOKEN, QB_CONNECTION_ID, {
      name: "Office Supplies",
      accountType: "Expense",
      accountSubType: "Supplies",
    });

    const [path, body, config] = stub.mock.calls[0] as [string, Record<string, unknown>, { headers: Record<string, string> }];
    assert.equal(path, "/quickbooks/accounts");
    assert.deepEqual(body, { name: "Office Supplies", accountType: "Expense", accountSubType: "Supplies" });
    assert.equal(config.headers.Authorization, `Bearer ${ACCESS_TOKEN}`);
    assert.equal(config.headers["X-QB-Id"], QB_CONNECTION_ID);
    assert.equal((result as ToolResult).id, "a-1");
    assert.equal((result as ToolResult).name, "Office Supplies");
  });

  it("omits accountSubType when not provided", async () => {
    const stub = stubAxios("post", { data: { data: { account: { _id: "a-2" } } } });

    await createGLAccount(ACCESS_TOKEN, QB_CONNECTION_ID, {
      name: "Travel",
      accountType: "Expense",
    });

    const [, body] = stub.mock.calls[0] as [string, Record<string, unknown>];
    assert.deepEqual(body, { name: "Travel", accountType: "Expense" });
    assert.equal((body as Record<string, unknown>).accountSubType, undefined);
  });

  it("rejects a missing name/accountType before any network call", async () => {
    const stub = stubAxios("post", { data: {} });
    const result = (await createGLAccount(ACCESS_TOKEN, QB_CONNECTION_ID, {
      name: "",
      accountType: "",
    })) as ToolResult;
    assert.equal(result.success, false);
    assert.equal(stub.mock.calls.length, 0);
  });
});

describe("sync_accounts (POST /quickbooks/accounts/sync)", () => {
  it("sends POST with empty body to /quickbooks/accounts/sync", async () => {
    const stub = stubAxios("post", { data: { data: { synced: 15, added: 2, updated: 1 } } });

    const result = await syncGLAccounts(ACCESS_TOKEN, QB_CONNECTION_ID);

    const [path, body, config] = stub.mock.calls[0] as [string, Record<string, unknown>, { headers: Record<string, string> }];
    assert.equal(path, "/quickbooks/accounts/sync");
    assert.deepEqual(body, {});
    assert.equal(config.headers["X-QB-Id"], QB_CONNECTION_ID);
    assert.deepEqual(result, { synced: 15, added: 2, updated: 1 });
  });

  it("does not require confirm (non-destructive)", async () => {
    const stub = stubAxios("post", { data: { data: {} } });

    await syncGLAccounts(ACCESS_TOKEN, QB_CONNECTION_ID);

    assert.equal(stub.mock.calls.length, 1, "sync should fire immediately without confirm");
  });
});

describe("sync_tax_codes (POST /quickbooks/taxcodes/sync)", () => {
  it("sends POST with empty body to /quickbooks/taxcodes/sync", async () => {
    const stub = stubAxios("post", { data: { data: { synced: 5, added: 0, updated: 3 } } });

    const result = await syncTaxCodes(ACCESS_TOKEN, QB_CONNECTION_ID);

    const [path, body, config] = stub.mock.calls[0] as [string, Record<string, unknown>, { headers: Record<string, string> }];
    assert.equal(path, "/quickbooks/taxcodes/sync");
    assert.deepEqual(body, {});
    assert.equal(config.headers["X-QB-Id"], QB_CONNECTION_ID);
    assert.deepEqual(result, { synced: 5, added: 0, updated: 3 });
  });
});

describe("callTool dispatch", () => {
  it("routes create_vendor to the correct function", async () => {
    const stub = stubAxios("post", { data: { data: { vendor: { _id: "v-99", displayName: "Test Co" } } } });

    const result = await callTool(
      "create_vendor",
      { displayName: "Test Co", currency: "USD", glAccountId: "gl-1" },
      ACCESS_TOKEN,
      QB_CONNECTION_ID,
    );

    const [path] = stub.mock.calls[0] as [string];
    assert.equal(path, "/quickbooks/vendors");
    assert.equal((result as ToolResult).id, "v-99");
  });

  it("routes reactivate_vendor to POST /reactivate", async () => {
    const stub = stubAxios("post", { data: { data: {} } });

    await callTool("reactivate_vendor", { vendorId: "v-1" }, ACCESS_TOKEN, QB_CONNECTION_ID);

    const [path] = stub.mock.calls[0] as [string];
    assert.equal(path, "/quickbooks/vendors/v-1/reactivate");
  });

  it("returns error for unknown tool names", async () => {
    const result = await callTool("nonexistent_tool", {}, ACCESS_TOKEN, QB_CONNECTION_ID);
    assert.equal((result as ToolResult).error, "Unknown tool: nonexistent_tool");
  });

  it("extracts the backend's own error message when the response body has one", async () => {
    const axiosError = Object.assign(new Error("Request failed with status code 400"), {
      isAxiosError: true,
      response: { status: 400, data: { message: "Vendor with this email already exists." } },
    });
    (axios as unknown as Record<string, unknown>).patch = () => Promise.reject(axiosError);

    const result = await callTool(
      "update_invoice",
      { invoiceId: "inv-1", extractedData: { totalAmount: 100 } },
      ACCESS_TOKEN,
      QB_CONNECTION_ID,
    );

    assert.equal((result as ToolResult).success, false);
    assert.equal((result as ToolResult).message, "Vendor with this email already exists.");
  });

  it("falls back to the plain error message when the backend gives no message", async () => {
    (axios as unknown as Record<string, unknown>).patch = () =>
      Promise.reject(new Error("Request failed with status code 500"));

    const result = await callTool(
      "update_invoice",
      { invoiceId: "inv-1", extractedData: { totalAmount: 100 } },
      ACCESS_TOKEN,
      QB_CONNECTION_ID,
    );

    assert.equal((result as ToolResult).success, false);
    assert.equal((result as ToolResult).message, "Request failed with status code 500");
  });

  it("includes all 10 write tool names in TOOL_NAMES", () => {
    const writeTools = [
      "update_invoice",
      "post_invoice_to_qb",
      "reject_invoice",
      "create_vendor",
      "update_vendor",
      "deactivate_vendor",
      "reactivate_vendor",
      "create_gl_account",
      "sync_accounts",
      "sync_tax_codes",
    ];
    for (const name of writeTools) {
      assert.ok(TOOL_NAMES.includes(name as ToolName), `Missing tool: ${name}`);
    }
  });
});

// ── Security regressions (added after the production audit) ──────────────
//
// Each of these covers a defect that was verified to be exploitable against
// the deployed system, so they exist to make sure it cannot come back.

describe("path traversal in model-supplied ids", () => {
  // Ids reach these tools from the model, which is influenced by OCR'd
  // invoice text an outsider can author. axios resolves the request URL
  // through WHATWG URL, which collapses "..", so an unencoded id escaped both
  // /invoices/ and the /api base and reached arbitrary backend endpoints.
  const TRAVERSAL = "../../users/me";

  it("rejects a traversing invoiceId before any network call", async () => {
    const stub = stubAxios("patch", { data: {} });
    const result = (await callTool(
      "reject_invoice",
      { invoiceId: TRAVERSAL, confirm: true },
      ACCESS_TOKEN,
      QB_CONNECTION_ID,
      { userConfirmed: true },
    )) as ToolResult;
    assert.equal(result.success, false);
    assert.match(result.message ?? "", /Invalid invoiceId/);
    assert.equal(stub.mock.calls.length, 0);
  });

  it("rejects a traversing vendorId before any network call", async () => {
    const stub = stubAxios("delete", { data: {} });
    const result = (await callTool(
      "deactivate_vendor",
      { vendorId: "../../../api/invoices/x", confirm: true },
      ACCESS_TOKEN,
      QB_CONNECTION_ID,
      { userConfirmed: true },
    )) as ToolResult;
    assert.equal(result.success, false);
    assert.match(result.message ?? "", /Invalid vendorId/);
    assert.equal(stub.mock.calls.length, 0);
  });

  it("still allows ordinary ids through, url-encoded", async () => {
    const stub = stubAxios("patch", { data: { data: { invoice: { _id: "inv-1" } } } });
    await callTool(
      "reject_invoice",
      { invoiceId: "inv-1", confirm: true },
      ACCESS_TOKEN,
      QB_CONNECTION_ID,
      { userConfirmed: true },
    );
    const [path] = stub.mock.calls[0] as [string];
    assert.equal(path, "/invoices/inv-1");
  });
});

describe("destructive actions require a real user confirmation", () => {
  // requireConfirm only inspects args.confirm, which the MODEL writes. Probing
  // the live prompt showed the model setting confirm:true and executing a
  // write on the first turn with no dialog ever shown. The human's click,
  // reported by the client, is the actual authorization.
  const DESTRUCTIVE: [ToolName, Record<string, unknown>, "patch" | "delete"][] = [
    ["reject_invoice", { invoiceId: "inv-1", confirm: true }, "patch"],
    ["deactivate_vendor", { vendorId: "ven-1", confirm: true }, "delete"],
  ];

  for (const [tool, args, method] of DESTRUCTIVE) {
    it(`${tool}: confirm:true alone does NOT execute without the user's click`, async () => {
      const stub = stubAxios(method, { data: {} });
      const result = (await callTool(tool, args, ACCESS_TOKEN, QB_CONNECTION_ID)) as ToolResult;
      assert.equal(result.success, false);
      assert.equal(result.confirmationRequired, true);
      assert.equal(stub.mock.calls.length, 0, "must not reach the backend");
    });

    it(`${tool}: executes once the user has confirmed in the app`, async () => {
      const stub = stubAxios(method, { data: { data: {} } });
      await callTool(tool, args, ACCESS_TOKEN, QB_CONNECTION_ID, { userConfirmed: true });
      assert.equal(stub.mock.calls.length, 1);
    });
  }

  it("a non-destructive tool is unaffected by the gate", async () => {
    const stub = stubAxios("post", { data: { data: { synced: 1 } } });
    await callTool("sync_accounts", {}, ACCESS_TOKEN, QB_CONNECTION_ID);
    assert.equal(stub.mock.calls.length, 1);
  });
});

describe("sync tools do not forward raw backend records to the model", () => {
  it("keeps only scalar counters, dropping internal record fields", async () => {
    stubAxios("post", {
      data: {
        data: {
          synced: 3,
          added: 1,
          accounts: [{ _id: "gl-1", qbConnectionId: "qb-1", realmId: "123", isDeleted: false }],
        },
      },
    });
    const result = (await syncGLAccounts(ACCESS_TOKEN, QB_CONNECTION_ID)) as Record<string, unknown>;
    assert.deepEqual(result, { synced: 3, added: 1 });
    assert.equal("accounts" in result, false, "raw records must not reach the model");
  });

  it("falls back to a safe stub when the shape is unrecognised", async () => {
    stubAxios("post", { data: { data: { accounts: [{ _id: "tc-1", realmId: "123" }] } } });
    const result = (await syncTaxCodes(ACCESS_TOKEN, QB_CONNECTION_ID)) as Record<string, unknown>;
    assert.deepEqual(result, { success: "ok" });
  });
});
