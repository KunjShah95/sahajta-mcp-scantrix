// Adversarial tests for the destructive-action consent gate.
//
// Each test below corresponds to an attack that was actually demonstrated
// against an earlier design, so a regression here is not theoretical:
//
//  - "model self-authorizes"  — proved live: with the real prompt/schemas the
//    model set confirm:true and executed a write on turn one.
//  - "mint and spend in one turn" — the failure mode of a consent token that
//    is handed to the model on request.
//  - "consent reused on a different record" — proved live: after a generic
//    "Yes, proceed." the model resolved an ambiguous vendor name to one of two
//    near-identical records by itself.
//
// Run with: npm test
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import axios from "axios";

import { callTool } from "../lib/chatbot/tools";
import { ConsumedOperations, mintConsentTicket, verifyConsentTicket, __testing } from "../lib/chatbot/consent";

const TOKEN = "user-a-access-token";
const OTHER_TOKEN = "user-b-access-token";
const QB = "qb-conn-1";

interface Gate {
  success?: boolean;
  confirmationRequired?: boolean;
  message?: string;
  confirmationToken?: string;
}

const originalPatch = axios.patch;
const originalDelete = axios.delete;
afterEach(() => {
  axios.patch = originalPatch;
  axios.delete = originalDelete;
});

let calls: string[] = [];
function stubNetwork() {
  calls = [];
  axios.patch = ((p: string) => {
    calls.push(`PATCH ${p}`);
    return Promise.resolve({ data: { data: { _id: "inv" } } });
  }) as unknown as typeof axios.patch;
  axios.delete = ((p: string) => {
    calls.push(`DELETE ${p}`);
    return Promise.resolve({ data: { data: {} } });
  }) as unknown as typeof axios.delete;
}

describe("consent gate — factor 1: a human must actually have clicked", () => {
  it("blocks a destructive write when the model sets confirm:true on its own", async () => {
    stubNetwork();
    const r = (await callTool(
      "reject_invoice",
      { invoiceId: "inv-1", confirm: true },
      TOKEN,
      QB,
      { requestId: "req-1", consumed: new ConsumedOperations() },
    )) as Gate;
    assert.equal(calls.length, 0, "no network call may happen without a human click");
    assert.equal(r.confirmationRequired, true);
  });

  it("blocks post_invoice_to_qb and deactivate_vendor the same way", async () => {
    for (const [tool, args] of [
      ["post_invoice_to_qb", { invoiceId: "i1", vendorId: "v1", extractedData: {}, confirm: true }],
      ["deactivate_vendor", { vendorId: "v1", confirm: true }],
    ] as const) {
      stubNetwork();
      await callTool(tool, args as Record<string, unknown>, TOKEN, QB, {
        requestId: "req-1",
        consumed: new ConsumedOperations(),
      });
      assert.equal(calls.length, 0, `${tool} executed without a human click`);
    }
  });

  it("mints the ticket for the CLIENT and never exposes it to the model", async () => {
    stubNetwork();
    const pendingTickets: string[] = [];
    const r = (await callTool("reject_invoice", { invoiceId: "inv-1" }, TOKEN, QB, {
      requestId: "req-1",
      consumed: new ConsumedOperations(),
      pendingTickets,
    })) as Gate;

    assert.equal(pendingTickets.length, 1, "the route needs a ticket to hand to the client");
    // The whole point: if the model could read the ticket it could mint and
    // spend its own consent, which is how a previous design was defeated.
    assert.equal(r.confirmationToken, undefined, "ticket must not appear in the model-visible result");
    assert.equal(JSON.stringify(r).includes(pendingTickets[0]), false, "ticket must not leak anywhere in the tool result");
  });
});

describe("consent gate — factor 2: the ticket must match this exact operation", () => {
  it("executes when the human confirmed and the ticket matches (happy path)", async () => {
    const ticket = mintConsentTicket("reject_invoice", { invoiceId: "inv-9" }, TOKEN, "req-1");
    stubNetwork();
    await callTool(
      "reject_invoice",
      { invoiceId: "inv-9", confirm: true },
      TOKEN,
      QB,
      { userConfirmed: true, requestId: "req-2", consumed: new ConsumedOperations(), confirmedTicket: ticket },
    );
    assert.deepEqual(calls, ["PATCH /invoices/inv-9"]);
  });

  it("refuses a ticket minted in the SAME request (mint-and-spend in one turn)", async () => {
    const ticket = mintConsentTicket("reject_invoice", { invoiceId: "inv-9" }, TOKEN, "req-2");
    stubNetwork();
    const r = (await callTool(
      "reject_invoice",
      { invoiceId: "inv-9", confirm: true },
      TOKEN,
      QB,
      { userConfirmed: true, requestId: "req-2", consumed: new ConsumedOperations(), confirmedTicket: ticket },
    )) as Gate;
    assert.equal(calls.length, 0, "a ticket must not be spendable in the turn that minted it");
    assert.equal(r.confirmationRequired, true);
  });

  it("refuses a ticket issued for a DIFFERENT record", async () => {
    const ticketForA = mintConsentTicket("deactivate_vendor", { vendorId: "vendor-A" }, TOKEN, "req-1");
    stubNetwork();
    const r = (await callTool(
      "deactivate_vendor",
      { vendorId: "vendor-B", confirm: true },
      TOKEN,
      QB,
      { userConfirmed: true, requestId: "req-2", consumed: new ConsumedOperations(), confirmedTicket: ticketForA },
    )) as Gate;
    assert.equal(calls.length, 0, "consent for vendor-A must not deactivate vendor-B");
    assert.match(r.message ?? "", /different record/i);
  });

  it("refuses a ticket issued for a different TOOL", async () => {
    const ticket = mintConsentTicket("reject_invoice", { invoiceId: "inv-9" }, TOKEN, "req-1");
    stubNetwork();
    await callTool(
      "post_invoice_to_qb",
      { invoiceId: "inv-9", vendorId: "v1", extractedData: {}, confirm: true },
      TOKEN,
      QB,
      { userConfirmed: true, requestId: "req-2", consumed: new ConsumedOperations(), confirmedTicket: ticket },
    );
    assert.equal(calls.length, 0);
  });

  it("refuses another user's ticket (key is derived from the caller's token)", async () => {
    const ticket = mintConsentTicket("reject_invoice", { invoiceId: "inv-9" }, OTHER_TOKEN, "req-1");
    stubNetwork();
    await callTool(
      "reject_invoice",
      { invoiceId: "inv-9", confirm: true },
      TOKEN,
      QB,
      { userConfirmed: true, requestId: "req-2", consumed: new ConsumedOperations(), confirmedTicket: ticket },
    );
    assert.equal(calls.length, 0, "user B's ticket must not authorize user A's write");
  });

  it("refuses a tampered ticket", async () => {
    const ticket = mintConsentTicket("reject_invoice", { invoiceId: "inv-9" }, TOKEN, "req-1");
    const tampered = ticket.slice(0, -3) + "abc";
    stubNetwork();
    await callTool(
      "reject_invoice",
      { invoiceId: "inv-9", confirm: true },
      TOKEN,
      QB,
      { userConfirmed: true, requestId: "req-2", consumed: new ConsumedOperations(), confirmedTicket: tampered },
    );
    assert.equal(calls.length, 0);
  });
});

describe("consent gate — single use within a turn", () => {
  it("does not let one confirmed ticket drive the same write twice", async () => {
    const ticket = mintConsentTicket("post_invoice_to_qb", { invoiceId: "i1", vendorId: "v1", extractedData: {} }, TOKEN, "req-1");
    const consumed = new ConsumedOperations();
    const args = { invoiceId: "i1", vendorId: "v1", extractedData: {}, confirm: true };
    const opts = { userConfirmed: true, requestId: "req-2", consumed, confirmedTicket: ticket };

    stubNetwork();
    await callTool("post_invoice_to_qb", { ...args }, TOKEN, QB, opts);
    assert.equal(calls.length, 1, "first confirmed post should go through");

    stubNetwork();
    await callTool("post_invoice_to_qb", { ...args }, TOKEN, QB, opts);
    assert.equal(calls.length, 0, "a repeated identical post would be a duplicate bill");
  });
});

describe("consent ticket internals", () => {
  it("canonicalizes nested objects order-independently", () => {
    const a = __testing.fingerprint("t", { x: { b: 2, a: 1 }, y: [1, { d: 4, c: 3 }] });
    const b = __testing.fingerprint("t", { y: [1, { c: 3, d: 4 }], x: { a: 1, b: 2 } });
    assert.equal(a, b, "re-emitted args with keys in another order must still match");
  });

  it("ignores the confirmation plumbing when fingerprinting", () => {
    const bare = __testing.fingerprint("t", { invoiceId: "i1" });
    const withPlumbing = __testing.fingerprint("t", { invoiceId: "i1", confirm: true, confirmationToken: "zzz" });
    assert.equal(bare, withPlumbing);
  });

  it("treats an expired ticket as invalid", () => {
    const ticket = mintConsentTicket("reject_invoice", { invoiceId: "i" }, TOKEN, "req-1");
    const [v, rid, , mac] = ticket.split(".");
    const stale = `${v}.${rid}.${Date.now() - 11 * 60_000}.${mac}`;
    const verdict = verifyConsentTicket(stale, "reject_invoice", { invoiceId: "i" }, TOKEN, "req-2");
    assert.equal(verdict.ok, false);
  });

  it("reports missing rather than throwing when no ticket is supplied", () => {
    const verdict = verifyConsentTicket(undefined, "reject_invoice", { invoiceId: "i" }, TOKEN, "req-2");
    assert.deepEqual(verdict, { ok: false, reason: "missing" });
  });

  it("accepts a valid ticket across requests", () => {
    const ticket = mintConsentTicket("reject_invoice", { invoiceId: "i" }, TOKEN, "req-1");
    assert.deepEqual(verifyConsentTicket(ticket, "reject_invoice", { invoiceId: "i" }, TOKEN, "req-2"), { ok: true });
  });
});

describe("non-destructive tools are unaffected", () => {
  it("update_invoice still runs without any confirmation ceremony", async () => {
    stubNetwork();
    await callTool(
      "update_invoice",
      { invoiceId: "inv-5", extractedData: { totalAmount: 10 } },
      TOKEN,
      QB,
      { requestId: "req-1", consumed: new ConsumedOperations() },
    );
    assert.deepEqual(calls, ["PATCH /invoices/inv-5"]);
  });
});
