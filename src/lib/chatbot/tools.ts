// Retrieval tools for the chatbot — thin wrappers over the same Savetrix
// REST endpoints every other screen in this app calls, modeled directly on
// mcp/mcp-server/src/client/invoices.ts / vendors.ts. Each function takes
// (accessToken, qbConnectionId, args) as required, explicit parameters
// rather than reading them from anywhere ambient — see architecture doc
// §7.3: making qbConnectionId optional is how you accidentally serve one
// company's data as another's.
//
// Deliberately does NOT use src/lib/api.ts: that client is a singleton with
// a request interceptor reading a module-level qbConnectionId (see
// lib/qbConnection.ts) meant for one browser tab's one active session. This
// route handler serves concurrent requests from different users/companies,
// so headers must be attached per-request instead.
import axios from "axios";

import type { InvoiceRecord } from "@/store/invoice/invoiceSlice";
import type { GLAccount, TaxCode, Vendor } from "@/store/quickBooks/quickBooksSlice";
import { getInvoiceStatus } from "@/lib/invoiceDisplay";
import {
  toGLAccountChatContext,
  toInvoiceChatContext,
  toInvoiceDetailChatContext,
  toTaxCodeChatContext,
  toVendorChatContext,
  type GLAccountChatContext,
  type InvoiceChatContext,
  type InvoiceDetailChatContext,
  type TaxCodeChatContext,
  type VendorChatContext,
} from "./context";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.savetrix.com/api";

const PAGE_LIMIT = 100;
// Caps how many records any single tool call can hand to the model — keeps
// token usage/cost bounded and doubles as part of the "no rate limiting"
// mitigation from architecture doc §7.11.
const MAX_RESULTS_RETURNED = 20;

function savetrixGet<T>(
  path: string,
  accessToken: string,
  qbConnectionId: string,
  params?: Record<string, unknown>,
) {
  return axios.get<T>(path, {
    baseURL: BASE_URL,
    timeout: 30000,
    params,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "X-QB-Id": qbConnectionId,
    },
  });
}

// Fetches every page of /invoices — the backend caps at limit=100/page (see
// getInvoices in src/store/invoice/invoiceApi.ts, the pattern this copies).
// Skipping this would make any "how many/how much" answer silently
// undercount once a company passes 100 invoices (architecture doc §7.4).
async function fetchAllInvoices(
  accessToken: string,
  qbConnectionId: string,
  status?: string,
): Promise<InvoiceRecord[]> {
  type InvoicesResponse = {
    data?: { invoices?: InvoiceRecord[]; pagination?: { totalPages?: number } };
  };

  const baseParams = { limit: PAGE_LIMIT, ...(status ? { status } : {}) };
  const first = await savetrixGet<InvoicesResponse>("/invoices", accessToken, qbConnectionId, {
    page: 1,
    ...baseParams,
  });
  const totalPages = first.data?.data?.pagination?.totalPages || 1;
  let invoices = first.data?.data?.invoices || [];

  if (totalPages > 1) {
    const pageRequests = [];
    for (let page = 2; page <= totalPages; page++) {
      pageRequests.push(
        savetrixGet<InvoicesResponse>("/invoices", accessToken, qbConnectionId, { page, ...baseParams }),
      );
    }
    const rest = await Promise.all(pageRequests);
    for (const res of rest) invoices = invoices.concat(res.data?.data?.invoices || []);
  }

  return invoices;
}

function withinRange(dateStr: string | undefined, from: Date | null, to: Date | null): boolean {
  if (!from && !to) return true;
  if (!dateStr) return false;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return false;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

// ── list_invoices ────────────────────────────────────────────────────────

export interface ListInvoicesArgs {
  status?: "pending" | "manual" | "auto" | "failed" | "processing";
  vendorName?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
}

export interface ListInvoicesResult {
  invoices: InvoiceChatContext[];
  totalMatched: number;
}

// The backend doesn't support vendorName/date filtering server-side, so
// these are applied in code after fetching, the same way
// src/lib/globalSearch.ts filters already-loaded lists in memory.
export async function listInvoices(
  accessToken: string,
  qbConnectionId: string,
  args: ListInvoicesArgs,
): Promise<ListInvoicesResult> {
  const invoices = await fetchAllInvoices(accessToken, qbConnectionId, args.status);
  const from = args.fromDate ? new Date(args.fromDate) : null;
  const to = args.toDate ? new Date(args.toDate) : null;
  const vendorQuery = args.vendorName?.trim().toLowerCase();

  const filtered = invoices.filter((invoice) => {
    if (vendorQuery) {
      const vendor = invoice.extractedData?.vendorName?.toLowerCase() || "";
      if (!vendor.includes(vendorQuery)) return false;
    }
    return withinRange(invoice.extractedData?.invoiceDate || invoice.createdAt, from, to);
  });

  const limit = Math.max(1, Math.min(args.limit ?? MAX_RESULTS_RETURNED, MAX_RESULTS_RETURNED));
  return {
    invoices: filtered.slice(0, limit).map(toInvoiceChatContext),
    totalMatched: filtered.length,
  };
}

// ── get_invoice_detail ───────────────────────────────────────────────────

export async function getInvoiceDetail(
  accessToken: string,
  qbConnectionId: string,
  args: { invoiceId: string },
): Promise<InvoiceDetailChatContext | { error: string }> {
  try {
    const res = await savetrixGet<{ data?: { invoice?: InvoiceRecord } | InvoiceRecord }>(
      `/invoices/${args.invoiceId}`,
      accessToken,
      qbConnectionId,
    );
    const payload = res.data?.data;
    const invoice =
      payload && typeof payload === "object" && "invoice" in payload
        ? (payload as { invoice?: InvoiceRecord }).invoice
        : (payload as InvoiceRecord | undefined);
    if (!invoice) return { error: "Invoice not found." };
    return toInvoiceDetailChatContext(invoice);
  } catch {
    return { error: "Could not fetch that invoice. It may not exist, or may belong to a different company." };
  }
}

// ── summarize_spend ──────────────────────────────────────────────────────

export interface SummarizeSpendArgs {
  groupBy: "vendor" | "month" | "status";
  fromDate?: string;
  toDate?: string;
}

export interface SpendGroup {
  key: string;
  totals: { currency: string; total: number; count: number }[];
}

// Computes sums/counts in TypeScript instead of handing the model a list of
// raw amounts to add up itself (LLMs are unreliable at exact arithmetic —
// architecture doc §7.5). Groups by currency within each key so USD and EUR
// invoices, e.g., are never silently summed together (§7.7), following the
// same pattern as src/lib/topVendors.ts.
export async function summarizeSpend(
  accessToken: string,
  qbConnectionId: string,
  args: SummarizeSpendArgs,
): Promise<{ groups: SpendGroup[] }> {
  const invoices = await fetchAllInvoices(accessToken, qbConnectionId);
  const from = args.fromDate ? new Date(args.fromDate) : null;
  const to = args.toDate ? new Date(args.toDate) : null;

  const filtered = invoices.filter((invoice) =>
    withinRange(invoice.extractedData?.invoiceDate || invoice.createdAt, from, to),
  );

  const groups = new Map<string, Map<string, { total: number; count: number }>>();

  for (const invoice of filtered) {
    let key: string;
    if (args.groupBy === "vendor") {
      key = invoice.extractedData?.vendorName?.trim() || "Unknown vendor";
    } else if (args.groupBy === "status") {
      key = getInvoiceStatus(invoice.postedStatus);
    } else {
      const dateStr = invoice.extractedData?.invoiceDate || invoice.createdAt;
      const date = dateStr ? new Date(dateStr) : null;
      key =
        date && !Number.isNaN(date.getTime())
          ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
          : "Unknown month";
    }

    const currency = invoice.extractedData?.currency || "Unknown";
    const amount = invoice.extractedData?.totalAmount || 0;

    if (!groups.has(key)) groups.set(key, new Map());
    const currencyTotals = groups.get(key)!;
    const existing = currencyTotals.get(currency) || { total: 0, count: 0 };
    existing.total += amount;
    existing.count += 1;
    currencyTotals.set(currency, existing);
  }

  return {
    groups: [...groups.entries()].map(([key, currencyTotals]) => ({
      key,
      totals: [...currencyTotals.entries()].map(([currency, data]) => ({ currency, ...data })),
    })),
  };
}

// ── list_vendors / list_gl_accounts / list_tax_codes ────────────────────

export async function listVendors(
  accessToken: string,
  qbConnectionId: string,
  args: { status?: "active" | "inactive" },
): Promise<{ vendors: VendorChatContext[] }> {
  const res = await savetrixGet<{ data?: { vendors?: Vendor[] } }>(
    "/quickbooks/vendors",
    accessToken,
    qbConnectionId,
    args.status === "inactive" ? { status: "inactive" } : undefined,
  );
  const vendors = res.data?.data?.vendors || [];
  return { vendors: vendors.slice(0, MAX_RESULTS_RETURNED).map(toVendorChatContext) };
}

export async function listGLAccounts(
  accessToken: string,
  qbConnectionId: string,
): Promise<{ accounts: GLAccountChatContext[] }> {
  const res = await savetrixGet<{ data?: { accounts?: GLAccount[] } }>(
    "/quickbooks/accounts",
    accessToken,
    qbConnectionId,
  );
  const accounts = res.data?.data?.accounts || [];
  return { accounts: accounts.slice(0, MAX_RESULTS_RETURNED).map(toGLAccountChatContext) };
}

export async function listTaxCodes(
  accessToken: string,
  qbConnectionId: string,
): Promise<{ taxCodes: TaxCodeChatContext[] }> {
  // /quickbooks/taxcodes wraps its payload as data.items, not data.taxCodes —
  // see quickBooksApi.ts's fetchQuickBooksTaxCodes comment. Fall back across
  // every shape that's been observed, same as that thunk.
  const res = await savetrixGet<{ data?: unknown }>("/quickbooks/taxcodes", accessToken, qbConnectionId);
  const payload = res.data?.data as
    | { items?: TaxCode[]; taxCodes?: TaxCode[]; taxcodes?: TaxCode[] }
    | TaxCode[]
    | undefined;
  const items: TaxCode[] = Array.isArray(payload)
    ? payload
    : payload?.items || payload?.taxCodes || payload?.taxcodes || [];
  return { taxCodes: items.slice(0, MAX_RESULTS_RETURNED).map(toTaxCodeChatContext) };
}

// ── dispatcher ───────────────────────────────────────────────────────────

export const TOOL_NAMES = [
  "list_invoices",
  "get_invoice_detail",
  "summarize_spend",
  "list_vendors",
  "list_gl_accounts",
  "list_tax_codes",
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

// Every branch is caught individually so one failed Savetrix call becomes a
// plain-language tool result the model can relay ("couldn't find that"),
// never a crash of the whole streaming response.
export async function callTool(
  name: string,
  args: Record<string, unknown>,
  accessToken: string,
  qbConnectionId: string,
): Promise<unknown> {
  try {
    switch (name as ToolName) {
      case "list_invoices":
        return await listInvoices(accessToken, qbConnectionId, args as ListInvoicesArgs);
      case "get_invoice_detail":
        return await getInvoiceDetail(accessToken, qbConnectionId, args as { invoiceId: string });
      case "summarize_spend":
        return await summarizeSpend(accessToken, qbConnectionId, args as unknown as SummarizeSpendArgs);
      case "list_vendors":
        return await listVendors(accessToken, qbConnectionId, args as { status?: "active" | "inactive" });
      case "list_gl_accounts":
        return await listGLAccounts(accessToken, qbConnectionId);
      case "list_tax_codes":
        return await listTaxCodes(accessToken, qbConnectionId);
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch {
    return { error: "That lookup failed against the Savetrix backend. Say so plainly rather than guessing." };
  }
}
