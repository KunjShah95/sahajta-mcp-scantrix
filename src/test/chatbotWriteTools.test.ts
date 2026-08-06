// Tests for the chatbot's write tools (src/lib/chatbot/tools.ts).
//
// Verifies that write tool functions hit the correct REST endpoints with the
// right method + body, and that the confirm gate blocks destructive actions
// until confirm=true is passed — mirroring the MCP server's gates.ts pattern.
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
} from "../lib/chatbot/tools";

const ACCESS_TOKEN = "test-access-token";
const QB_CONNECTION_ID = "qb-conn-123";

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
function stubAxios(
  method: "get" | "post" | "patch" | "delete",
  response: unknown,
) {
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
  it("sends PATCH to /invoices/:id with extractedData body", async () => {
    const stub = stubAxios(
      "patch",
      { data: { data: { invoice: { _id: "inv-1" } } } },
    );

    const result = await updateInvoice(ACCESS_TOKEN, QB_CONNECTION_ID, {
      invoiceId: "inv-1",
      extractedData: { vendorName: "Acme Corp", totalAmount: 1500 },
    });

    const [path, body, config] = stub.mock.calls[0] as [string, any, any];
    assert.equal(path, "/invoices/inv-1");
    assert.deepEqual(body, { extractedData: { vendorName: "Acme Corp", totalAmount: 1500 } });
    assert.equal(config.headers.Authorization, `Bearer ${ACCESS_TOKEN}`);
    assert.equal(config.headers["X-QB-Id"], QB_CONNECTION_ID);
    assert.deepEqual(result, { invoice: { _id: "inv-1" } });
  });

  it("works through callTool dispatcher", async () => {
    const stub = stubAxios("patch", { data: { success: true } });

    const result = await callTool(
      "update_invoice",
      { invoiceId: "inv-1", extractedData: { glAccountId: "acct-1" } },
      ACCESS_TOKEN,
      QB_CONNECTION_ID,
    );

    assert.deepEqual(result, { success: true });
    const [path] = stub.mock.calls[0] as [string];
    assert.equal(path, "/invoices/inv-1");
  });
});

describe("post_invoice_to_qb (PATCH /invoices/:id — destructive)", () => {
  it("returns confirmationRequired when confirm is false", async () => {
    const result = (await postInvoiceToQuickBooks(ACCESS_TOKEN, QB_CONNECTION_ID, {
      invoiceId: "inv-1",
      vendorId: "v-1",
      extractedData: { vendorName: "Acme" },
      confirm: false,
    })) as any;

    assert.equal(result.success, false);
    assert.equal(result.confirmationRequired, true);
    assert.ok(result.message?.includes("confirmation"));
  });

  it("returns confirmationRequired when confirm is missing", async () => {
    const result = (await postInvoiceToQuickBooks(ACCESS_TOKEN, QB_CONNECTION_ID, {
      invoiceId: "inv-1",
      vendorId: "v-1",
      extractedData: { vendorName: "Acme" },
    } as any)) as any;

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
    const stub = stubAxios(
      "patch",
      { data: { data: { invoice: { _id: "inv-1" } } } },
    );

    const result = await postInvoiceToQuickBooks(ACCESS_TOKEN, QB_CONNECTION_ID, {
      invoiceId: "inv-1",
      vendorId: "v-1",
      extractedData: { vendorName: "Acme", totalAmount: 999 },
      confirm: true,
    });

    const [path, body, config] = stub.mock.calls[0] as [string, any, any];
    assert.equal(path, "/invoices/inv-1");
    assert.deepEqual(body, {
      vendorId: "v-1",
      postedStatus: "manual",
      extractedData: { vendorName: "Acme", totalAmount: 999 },
    });
    assert.equal(config.headers.Authorization, `Bearer ${ACCESS_TOKEN}`);
    assert.equal(config.headers["X-QB-Id"], QB_CONNECTION_ID);
    assert.deepEqual(result, { invoice: { _id: "inv-1" } });
  });
});

describe("reject_invoice (PATCH /invoices/:id — destructive)", () => {
  it("returns confirmationRequired when confirm is false", async () => {
    const result = (await rejectInvoice(ACCESS_TOKEN, QB_CONNECTION_ID, {
      invoiceId: "inv-1",
      reason: "duplicate",
      confirm: false,
    })) as any;

    assert.equal(result.success, false);
    assert.equal(result.confirmationRequired, true);
  });

  it("sends PATCH with postedStatus:failed + reason when confirm=true", async () => {
    const stub = stubAxios("patch", { data: { success: true } });

    const result = await rejectInvoice(ACCESS_TOKEN, QB_CONNECTION_ID, {
      invoiceId: "inv-1",
      reason: "bad scan",
      confirm: true,
    });

    const [path, body] = stub.mock.calls[0] as [string, any];
    assert.equal(path, "/invoices/inv-1");
    assert.deepEqual(body, { postedStatus: "failed", reason: "bad scan" });
    assert.deepEqual(result, { success: true });
  });

  it("omits reason when not provided", async () => {
    const stub = stubAxios("patch", { data: {} });

    await rejectInvoice(ACCESS_TOKEN, QB_CONNECTION_ID, {
      invoiceId: "inv-1",
      confirm: true,
    });

    const [, body] = stub.mock.calls[0] as [string, any];
    assert.deepEqual(body, { postedStatus: "failed" });
    assert.equal((body as any).reason, undefined);
  });
});

describe("create_vendor (POST /quickbooks/vendors)", () => {
  it("sends POST with required + optional fields", async () => {
    const stub = stubAxios(
      "post",
      { data: { data: { vendor: { _id: "v-1" } } } },
    );

    const result = await createVendor(ACCESS_TOKEN, QB_CONNECTION_ID, {
      displayName: "Acme Ltd",
      currency: "USD",
      email: "acme@example.com",
    });

    const [path, body, config] = stub.mock.calls[0] as [string, any, any];
    assert.equal(path, "/quickbooks/vendors");
    assert.equal(body.displayName, "Acme Ltd");
    assert.equal(body.currency, "USD");
    assert.equal(body.glAccountId, "");
    assert.equal(body.taxCodeId, "");
    assert.equal(body.email, "acme@example.com");
    assert.equal(body.phone, undefined);
    assert.equal(config.headers["X-QB-Id"], QB_CONNECTION_ID);
    assert.deepEqual(result, { vendor: { _id: "v-1" } });
  });
});

describe("update_vendor (PATCH /quickbooks/vendors/:id)", () => {
  it("sends PATCH with only the provided fields", async () => {
    const stub = stubAxios("patch", { data: { success: true } });

    await updateVendor(ACCESS_TOKEN, QB_CONNECTION_ID, {
      vendorId: "v-1",
      email: "new@example.com",
      phone: "555-1234",
    });

    const [path, body] = stub.mock.calls[0] as [string, any];
    assert.equal(path, "/quickbooks/vendors/v-1");
    assert.deepEqual(body, { email: "new@example.com", phone: "555-1234" });
  });

  it("excludes undefined fields from the body", async () => {
    const stub = stubAxios("patch", { data: {} });

    await updateVendor(ACCESS_TOKEN, QB_CONNECTION_ID, {
      vendorId: "v-1",
      displayName: "New Name",
    });

    const [, body] = stub.mock.calls[0] as [string, any];
    assert.equal(Object.keys(body).length, 1);
    assert.deepEqual(body, { displayName: "New Name" });
  });
});

describe("deactivate_vendor (DELETE /quickbooks/vendors/:id — destructive)", () => {
  it("returns confirmationRequired when confirm is false", async () => {
    const result = (await deactivateVendor(ACCESS_TOKEN, QB_CONNECTION_ID, {
      vendorId: "v-1",
      confirm: false,
    })) as any;

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
    const stub = stubAxios(
      "delete",
      { data: { data: { success: true } } },
    );

    const result = await deactivateVendor(ACCESS_TOKEN, QB_CONNECTION_ID, {
      vendorId: "v-1",
      confirm: true,
    });

    const [path, config] = stub.mock.calls[0] as [string, any];
    assert.equal(path, "/quickbooks/vendors/v-1");
    assert.equal(config.headers["X-QB-Id"], QB_CONNECTION_ID);
    assert.equal((result as any).success, true);
  });
});

describe("reactivate_vendor (POST /quickbooks/vendors/:id/reactivate)", () => {
  it("sends POST with empty body", async () => {
    const stub = stubAxios(
      "post",
      { data: { data: { vendor: { _id: "v-1", status: "active" } } } },
    );

    const result = await reactivateVendor(ACCESS_TOKEN, QB_CONNECTION_ID, { vendorId: "v-1" });

    const [path, body, config] = stub.mock.calls[0] as [string, any, any];
    assert.equal(path, "/quickbooks/vendors/v-1/reactivate");
    assert.deepEqual(body, {});
    assert.equal(config.headers["X-QB-Id"], QB_CONNECTION_ID);
    assert.deepEqual(result, { vendor: { _id: "v-1", status: "active" } });
  });
});

describe("create_gl_account (POST /quickbooks/accounts)", () => {
  it("sends POST with name and accountType", async () => {
    const stub = stubAxios(
      "post",
      { data: { data: { account: { _id: "a-1" } } } },
    );

    const result = await createGLAccount(ACCESS_TOKEN, QB_CONNECTION_ID, {
      name: "Office Supplies",
      accountType: "Expense",
      accountSubType: "Supplies",
    });

    const [path, body, config] = stub.mock.calls[0] as [string, any, any];
    assert.equal(path, "/quickbooks/accounts");
    assert.deepEqual(body, { name: "Office Supplies", accountType: "Expense", accountSubType: "Supplies" });
    assert.equal(config.headers.Authorization, `Bearer ${ACCESS_TOKEN}`);
    assert.equal(config.headers["X-QB-Id"], QB_CONNECTION_ID);
    assert.deepEqual(result, { account: { _id: "a-1" } });
  });

  it("omits accountSubType when not provided", async () => {
    const stub = stubAxios("post", { data: {} });

    await createGLAccount(ACCESS_TOKEN, QB_CONNECTION_ID, {
      name: "Travel",
      accountType: "Expense",
    });

    const [, body] = stub.mock.calls[0] as [string, any];
    assert.deepEqual(body, { name: "Travel", accountType: "Expense" });
    assert.equal((body as any).accountSubType, undefined);
  });
});

describe("sync_accounts (POST /quickbooks/accounts/sync)", () => {
  it("sends POST with empty body to /quickbooks/accounts/sync", async () => {
    const stub = stubAxios(
      "post",
      { data: { data: { synced: 15, added: 2, updated: 1 } } },
    );

    const result = await syncGLAccounts(ACCESS_TOKEN, QB_CONNECTION_ID);

    const [path, body, config] = stub.mock.calls[0] as [string, any, any];
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
    const stub = stubAxios(
      "post",
      { data: { data: { synced: 5, added: 0, updated: 3 } } },
    );

    const result = await syncTaxCodes(ACCESS_TOKEN, QB_CONNECTION_ID);

    const [path, body, config] = stub.mock.calls[0] as [string, any, any];
    assert.equal(path, "/quickbooks/taxcodes/sync");
    assert.deepEqual(body, {});
    assert.equal(config.headers["X-QB-Id"], QB_CONNECTION_ID);
    assert.deepEqual(result, { synced: 5, added: 0, updated: 3 });
  });
});

describe("callTool dispatch", () => {
  it("routes create_vendor to the correct function", async () => {
    const stub = stubAxios(
      "post",
      { data: { data: { vendor: { _id: "v-99" } } } },
    );

    const result = await callTool(
      "create_vendor",
      { displayName: "Test Co", currency: "USD" },
      ACCESS_TOKEN,
      QB_CONNECTION_ID,
    );

    const [path] = stub.mock.calls[0] as [string];
    assert.equal(path, "/quickbooks/vendors");
    assert.deepEqual(result, { vendor: { _id: "v-99" } });
  });

  it("routes reactivate_vendor to POST /reactivate", async () => {
    const stub = stubAxios("post", { data: { data: {} } });

    await callTool("reactivate_vendor", { vendorId: "v-1" }, ACCESS_TOKEN, QB_CONNECTION_ID);

    const [path] = stub.mock.calls[0] as [string];
    assert.equal(path, "/quickbooks/vendors/v-1/reactivate");
  });

  it("returns error for unknown tool names", async () => {
    const result = await callTool("nonexistent_tool", {}, ACCESS_TOKEN, QB_CONNECTION_ID);
    assert.equal((result as any).error, "Unknown tool: nonexistent_tool");
  });

  it("catches backend errors gracefully", async () => {
    (axios as unknown as Record<string, unknown>).patch = (..._args: unknown[]) =>
      Promise.reject(new Error("Request failed with status code 500"));

    const result = await callTool(
      "update_invoice",
      { invoiceId: "inv-1", extractedData: { totalAmount: 100 } },
      ACCESS_TOKEN,
      QB_CONNECTION_ID,
    );

    assert.equal((result as any).success, false);
    assert.equal((result as any).message, "Request failed with status code 500");
  });

  it("includes all 8 write tool names in TOOL_NAMES", () => {
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
      assert.ok(TOOL_NAMES.includes(name as any), `Missing tool: ${name}`);
    }
  });
});
