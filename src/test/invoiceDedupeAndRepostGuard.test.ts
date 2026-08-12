// Tests for the duplicate-invoice fixes:
//   1. getInvoices dedupes page-fetched results by _id (a record can appear
//      on two pages when list ordering shifts mid-fetch, or the backend can
//      return a duplicate outright — both caused the same invoice/bill to
//      show up twice and look like a duplicate in QuickBooks).
//   2. postInvoiceToQuickBooks (thunk) refuses to re-post an invoice that
//      already carries a billId or a terminal posted status, so a scan that
//      errored client-side but was actually posted server-side can never be
//      posted a second time into QuickBooks.
//
// Run with: npm test   (node --import tsx --test src/test/*.test.ts)
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { configureStore, type UnknownAction } from "@reduxjs/toolkit";

import api from "../lib/api";
import invoiceReducer from "../store/invoice/invoiceSlice";
import {
  getInvoices,
  postInvoiceToQuickBooks,
} from "../store/invoice/invoiceApi";
import type { InvoiceRecord } from "../store/invoice/invoiceSlice";

// Save originals so we never leak mocks between tests.
const originalGet = api.get;
const originalPatch = api.patch;

afterEach(() => {
  api.get = originalGet;
  api.patch = originalPatch;
});

const makeInvoice = (overrides: Partial<InvoiceRecord>): InvoiceRecord => ({
  _id: "inv-1",
  postedStatus: "pending",
  extractedData: { vendorName: "Acme Corp", invoiceNumber: "INV-100", totalAmount: 500 },
  ...overrides,
});

const makeStore = () =>
  configureStore({
    reducer: { invoice: invoiceReducer },
  });

const listResponse = (invoices: InvoiceRecord[], totalPages = 1) => ({
  data: {
    data: {
      invoices,
      pagination: { totalPages },
    },
  },
});

describe("getInvoices dedupes by _id", () => {
  it("keeps a single copy when the same invoice appears on two pages", async () => {
    api.get = (async (...args: unknown[]) => {
      const url = args[0] as string;
      if (url === "/invoices?page=1&limit=100") {
        return listResponse(
          [makeInvoice({ _id: "inv-a", postedStatus: "pending", extractedData: { vendorName: "Alpha" } })],
          2,
        );
      }
      // Page 2 repeats the same invoice (ordering shifted between fetches).
      return listResponse(
        [makeInvoice({ _id: "inv-a", postedStatus: "pending", extractedData: { vendorName: "Alpha" } })],
      );
    }) as typeof api.get;

    const store = makeStore();
    await store.dispatch(getInvoices() as unknown as UnknownAction);

    const { invoices } = store.getState().invoice;
    assert.equal(invoices.length, 1);
    assert.equal(invoices[0]._id, "inv-a");
  });

  it("drops an exact duplicate returned by the backend on a single page", async () => {
    api.get = (async (...args: unknown[]) => {
      const url = args[0] as string;
      if (url === "/invoices?page=1&limit=100") {
        // Page 1 itself contains the same invoice twice.
        return listResponse([
          makeInvoice({ _id: "inv-b", postedStatus: "manual", extractedData: { vendorName: "Beta" } }),
          makeInvoice({ _id: "inv-c", postedStatus: "pending", extractedData: { vendorName: "Gamma" } }),
          makeInvoice({ _id: "inv-b", postedStatus: "manual", extractedData: { vendorName: "Beta" } }),
        ]);
      }
      return listResponse([]);
    }) as typeof api.get;

    const store = makeStore();
    await store.dispatch(getInvoices() as unknown as UnknownAction);

    const { invoices } = store.getState().invoice;
    assert.equal(invoices.length, 2);
    assert.deepEqual(
      invoices.map((i) => i._id).sort(),
      ["inv-b", "inv-c"],
    );
  });

  it("keeps distinct invoices intact across pages", async () => {
    api.get = (async (...args: unknown[]) => {
      const url = args[0] as string;
      if (url === "/invoices?page=1&limit=100") {
        return listResponse(
          [makeInvoice({ _id: "inv-1", postedStatus: "pending", extractedData: { vendorName: "One" } })],
          2,
        );
      }
      return listResponse(
        [makeInvoice({ _id: "inv-2", postedStatus: "pending", extractedData: { vendorName: "Two" } })],
      );
    }) as typeof api.get;

    const store = makeStore();
    await store.dispatch(getInvoices() as unknown as UnknownAction);

    const { invoices } = store.getState().invoice;
    assert.equal(invoices.length, 2);
    assert.deepEqual(
      invoices.map((i) => i._id).sort(),
      ["inv-1", "inv-2"],
    );
  });
});

describe("postInvoiceToQuickBooks idempotency guard", () => {
  const postPayload = {
    invoiceId: "inv-1",
    vendorId: "v-1",
    extractedData: {
      vendorName: "Acme Corp",
      currency: "USD",
      invoiceNumber: "INV-100",
      amountBeforeTax: 500,
      taxAmount: 0,
      totalAmount: 500,
      lineItems: [],
    },
  };

  it("does not call the PATCH when the invoice already has a billId", async () => {
    let patchCalled = false;
    api.patch = (async () => {
      patchCalled = true;
      return { data: { data: { invoice: {} } } };
    }) as typeof api.patch;

    const store = makeStore();
    store.dispatch({
      type: "invoice/getInvoices/fulfilled",
      payload: [
        makeInvoice({
          _id: "inv-1",
          postedStatus: "pending",
          quickbooks: { billId: "QB-777" },
        }),
      ],
    } as never);

    const result = await store.dispatch(
      postInvoiceToQuickBooks(postPayload) as unknown as UnknownAction,
    );

    assert.match(String(result.payload), /already posted/i);
    assert.match(String(result.payload), /QB-777/);
    assert.equal(patchCalled, false, "PATCH must not fire when the bill already exists");
  });

  it("does not call the PATCH when postedStatus is already manual", async () => {
    let patchCalled = false;
    api.patch = (async () => {
      patchCalled = true;
      return { data: { data: { invoice: {} } } };
    }) as typeof api.patch;

    const store = makeStore();
    store.dispatch({
      type: "invoice/getInvoices/fulfilled",
      payload: [makeInvoice({ _id: "inv-1", postedStatus: "manual" })],
    } as never);

    const result = await store.dispatch(
      postInvoiceToQuickBooks(postPayload) as unknown as UnknownAction,
    );

    assert.match(String(result.payload), /already posted/i);
    assert.equal(patchCalled, false);
  });

  it("calls the PATCH when nothing in state indicates the invoice is posted", async () => {
    const patchBody: Record<string, unknown>[] = [];
    api.patch = (async (_path: unknown, body: unknown) => {
      patchBody.push(body as Record<string, unknown>);
      return { data: { data: { invoice: { _id: "inv-1", postedStatus: "manual" } } } };
    }) as typeof api.patch;

    const store = makeStore();
    store.dispatch({
      type: "invoice/getInvoices/fulfilled",
      payload: [makeInvoice({ _id: "inv-1", postedStatus: "pending" })],
    } as never);

    const result = await store.dispatch(
      postInvoiceToQuickBooks(postPayload) as unknown as UnknownAction,
    );

    const returned = result as { type: string; payload?: unknown };
    assert.equal(returned.type, "invoice/postInvoiceToQuickBooks/fulfilled");
    assert.equal(patchBody.length, 1);
    assert.equal((patchBody[0] as { postedStatus: string }).postedStatus, "manual");
  });
});