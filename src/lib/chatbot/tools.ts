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

import type { ExtractedData, InvoiceRecord } from "@/store/invoice/invoiceSlice";
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
import { mintConsentToken, verifyConsentToken } from "./consentTokens";

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

// ── Write helpers ───────────────────────────────────────────────────────────
// POST/PATCH/DELETE variants of savetrixGet — same per-request header injection so
// write operations are scoped to the requesting user's company exactly like reads.
// Modeled on mcp/mcp-server/src/client/invoices.ts and vendors.ts, which call
// client.api.patch/post/delete with the same Bearer + X-QB-Id headers.

function savetrixPost<T>(
  path: string,
  body: unknown,
  accessToken: string,
  qbConnectionId: string,
) {
  return axios.post<T>(path, body, {
    baseURL: BASE_URL,
    timeout: 30000,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "X-QB-Id": qbConnectionId,
    },
  });
}

function savetrixPatch<T>(
  path: string,
  body: unknown,
  accessToken: string,
  qbConnectionId: string,
) {
  return axios.patch<T>(path, body, {
    baseURL: BASE_URL,
    timeout: 30000,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "X-QB-Id": qbConnectionId,
    },
  });
}

function savetrixDelete<T>(path: string, accessToken: string, qbConnectionId: string) {
  return axios.delete<T>(path, {
    baseURL: BASE_URL,
    timeout: 30000,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "X-QB-Id": qbConnectionId,
    },
  });
}

// ── Confirmation gate ───────────────────────────────────────────────────────
// Destructive actions (post to QB, reject, deactivate, delete) require either:
// 1. confirm=true (legacy, model-controlled — security risk, deprecated)
// 2. confirmationToken bound to this exact (tool, args) pair (new, safe)
//
// When gate fails, return a structured message with a minted token. The model
// relays this to the user; if they approve, the model calls the tool again
// with the same token. Server validates token matches current tool+args.
export interface ConfirmGateResult {
  ok: boolean;
  message?: string;
  confirmationToken?: string;
}

export function requireConfirm(
  args: { confirm?: boolean; confirmationToken?: string },
  action: string,
  toolName?: string,
  requestSalt?: string,
): ConfirmGateResult {
  // Token-based confirmation (new, safer).
  if (args.confirmationToken && toolName && requestSalt) {
    const isValid = verifyConsentToken(args.confirmationToken, toolName, args, requestSalt);
    if (isValid) return { ok: true };
    // Token present but invalid — don't fall through to confirm check.
    return {
      ok: false,
      message: `Confirmation token expired or invalid. Please re-request confirmation.`,
    };
  }

  // Confirm flag (legacy, model-controlled).
  if (args.confirm !== true) {
    // Generate new token for this tool+args, if possible.
    let token: string | undefined;
    if (toolName && requestSalt) {
      try {
        token = mintConsentToken(toolName, args, requestSalt);
      } catch {
        // Token generation failed — fall back to legacy flow.
      }
    }

    return {
      ok: false,
      message:
        `Action "${action}" modifies data and requires explicit confirmation. ` +
        `Please confirm you want to do this, then I'll proceed.`,
      confirmationToken: token,
    };
  }
  return { ok: true };
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

// ── Write: Invoice ──────────────────────────────────────────────────────

export interface UpdateInvoiceArgs {
  invoiceId: string;
  extractedData: Partial<ExtractedData>;
}

// PATCH /invoices/:id — updates the extracted data on an invoice (vendor,
// amount, GL account, tax code, line items, dates, etc.) without posting it.
// Mirrors mcp/mcp-server/src/client/invoices.ts updateInvoiceExtractedData and
// src/store/invoice/invoiceApi.ts updateInvoiceExtractedData thunk.
// Destructive: requires confirm=true or valid confirmationToken.
export async function updateInvoice(
  accessToken: string,
  qbConnectionId: string,
  args: UpdateInvoiceArgs & { confirm?: boolean; confirmationToken?: string },
  requestSalt?: string,
): Promise<unknown> {
  if (!requestSalt) requestSalt = deriveRequestSalt(accessToken);
  const gate = gateConfirmation(args, "update_invoice", "update invoice details", requestSalt);
  if (!gate.ok) return gate;

  const res = await savetrixPatch<{ data?: unknown }>(
    `/invoices/${args.invoiceId}`,
    { extractedData: args.extractedData },
    accessToken,
    qbConnectionId,
  );
  return res.data?.data ?? res.data;
}

export interface PostInvoiceToQbArgs {
  invoiceId: string;
  vendorId: string;
  extractedData: Partial<ExtractedData>;
  confirm: boolean;
}

// PATCH /invoices/:id with vendorId + postedStatus:"manual" — sends an approved
// invoice into QuickBooks. Destructive: requires confirm=true.
// Mirrors mcp/mcp-server/src/client/invoices.ts postInvoiceToQuickBooks and
// src/store/invoice/invoiceApi.ts postInvoiceToQuickBooks thunk.
export async function postInvoiceToQuickBooks(
  accessToken: string,
  qbConnectionId: string,
  args: PostInvoiceToQbArgs,
  requestSalt?: string,
): Promise<unknown> {
  if (!requestSalt) requestSalt = deriveRequestSalt(accessToken);
  const gate = gateConfirmation(args, "post_invoice_to_qb", "post invoice to QuickBooks", requestSalt);
  if (!gate.ok) return gate;

  const res = await savetrixPatch<{ data?: unknown }>(
    `/invoices/${args.invoiceId}`,
    {
      vendorId: args.vendorId,
      postedStatus: "manual",
      extractedData: args.extractedData,
    },
    accessToken,
    qbConnectionId,
  );
  return res.data?.data ?? res.data;
}

export interface RejectInvoiceArgs {
  invoiceId: string;
  reason?: string;
  confirm: boolean;
}

// PATCH /invoices/:id with postedStatus:"failed" — rejects an invoice (duplicate,
// bad scan, etc.). Destructive: requires confirm=true.
// Mirrors mcp/mcp-server/src/client/invoices.ts rejectInvoice and
// src/store/invoice/invoiceApi.ts rejectInvoice thunk.
export async function rejectInvoice(
  accessToken: string,
  qbConnectionId: string,
  args: RejectInvoiceArgs,
  requestSalt?: string,
): Promise<unknown> {
  if (!requestSalt) requestSalt = deriveRequestSalt(accessToken);
  const gate = gateConfirmation(args, "reject_invoice", "reject invoice", requestSalt);
  if (!gate.ok) return gate;

  const res = await savetrixPatch<{ data?: unknown }>(
    `/invoices/${args.invoiceId}`,
    {
      postedStatus: "failed",
      ...(args.reason ? { reason: args.reason } : {}),
    },
    accessToken,
    qbConnectionId,
  );
  return res.data?.data ?? res.data;
}

// ── Write: Vendor ───────────────────────────────────────────────────────

export interface CreateVendorArgs {
  displayName: string;
  currency: string;
  email?: string;
  phone?: string;
  address?: string;
  glAccountId?: string;
  taxCodeId?: string;
}

// POST /quickbooks/vendors — creates a new vendor in QuickBooks.
// Mirrors mcp/mcp-server/src/client/vendors.ts createVendor and
// src/store/quickBooks/quickBooksApi.ts createQuickBooksVendor thunk.
export async function createVendor(
  accessToken: string,
  qbConnectionId: string,
  args: CreateVendorArgs,
): Promise<unknown> {
  const res = await savetrixPost<{ data?: unknown }>("/quickbooks/vendors", {
    displayName: args.displayName,
    currency: args.currency,
    glAccountId: args.glAccountId ?? "",
    taxCodeId: args.taxCodeId ?? "",
    ...(args.email ? { email: args.email } : {}),
    ...(args.phone ? { phone: args.phone } : {}),
    ...(args.address ? { address: args.address } : {}),
  }, accessToken, qbConnectionId);
  return res.data?.data ?? res.data;
}

export interface UpdateVendorArgs {
  vendorId: string;
  displayName?: string;
  currency?: string;
  email?: string;
  phone?: string;
  address?: string;
  glAccountId?: string;
  taxCodeId?: string;
}

// PATCH /quickbooks/vendors/:id — updates a vendor's details.
// Mirrors mcp/mcp-server/src/client/vendors.ts updateVendor and
// src/store/quickBooks/quickBooksApi.ts updateQuickBooksVendor thunk.
export async function updateVendor(
  accessToken: string,
  qbConnectionId: string,
  args: UpdateVendorArgs,
): Promise<unknown> {
  const { vendorId, ...fields } = args;
  const body: Record<string, string> = {};
  for (const key of ["displayName", "currency", "email", "phone", "address", "glAccountId", "taxCodeId"] as const) {
    if (fields[key] !== undefined) body[key] = fields[key] as string;
  }
  const res = await savetrixPatch<{ data?: unknown }>(
    `/quickbooks/vendors/${vendorId}`,
    body,
    accessToken,
    qbConnectionId,
  );
  return res.data?.data ?? res.data;
}

export interface DeactivateVendorArgs {
  vendorId: string;
  confirm: boolean;
}

// DELETE /quickbooks/vendors/:id — deactivates a vendor (hidden, not destroyed).
// Destructive: requires confirm=true.
// Mirrors mcp/mcp-server/src/client/vendors.ts deactivateVendor and
// src/store/quickBooks/quickBooksApi.ts deleteQuickBooksVendor thunk.
export async function deactivateVendor(
  accessToken: string,
  qbConnectionId: string,
  args: DeactivateVendorArgs,
  requestSalt?: string,
): Promise<unknown> {
  if (!requestSalt) requestSalt = deriveRequestSalt(accessToken);
  const gate = gateConfirmation(args, "deactivate_vendor", "deactivate vendor", requestSalt);
  if (!gate.ok) return gate;

  const res = await savetrixDelete<{ data?: unknown }>(
    `/quickbooks/vendors/${args.vendorId}`,
    accessToken,
    qbConnectionId,
  );
  return { success: true, ...(res.data?.data ?? res.data) };
}

export interface ReactivateVendorArgs {
  vendorId: string;
}

// POST /quickbooks/vendors/:id/reactivate — brings back a deactivated vendor.
// Mirrors mcp/mcp-server/src/client/vendors.ts reactivateVendor and
// src/store/quickBooks/quickBooksApi.ts reactivateQuickBooksVendor thunk.
export async function reactivateVendor(
  accessToken: string,
  qbConnectionId: string,
  args: ReactivateVendorArgs,
): Promise<unknown> {
  const res = await savetrixPost<{ data?: unknown }>(
    `/quickbooks/vendors/${args.vendorId}/reactivate`,
    {},
    accessToken,
    qbConnectionId,
  );
  return res.data?.data ?? res.data;
}

// ── Write: GL Account ─────────────────────────────────────────────────

export interface CreateGLAccountArgs {
  name: string;
  accountType: string;
  accountSubType?: string;
}

// POST /quickbooks/accounts — creates a new GL account in QuickBooks.
// Mirrors mcp/mcp-server/src/client/accounts.ts createAccount and
// src/store/quickBooks/quickBooksApi.ts createQuickBooksAccount thunk.
export async function createGLAccount(
  accessToken: string,
  qbConnectionId: string,
  args: CreateGLAccountArgs,
): Promise<unknown> {
  const res = await savetrixPost<{ data?: unknown }>("/quickbooks/accounts", {
    name: args.name,
    accountType: args.accountType,
    ...(args.accountSubType ? { accountSubType: args.accountSubType } : {}),
  }, accessToken, qbConnectionId);
  return res.data?.data ?? res.data;
}

// POST /quickbooks/accounts/sync — pulls the latest GL accounts from QuickBooks
// into the app's local store. Non-destructive (no data lost). Not in the MCP
// server's public tool set, but mirrors savetrix_account_sync for the web chat.
export async function syncGLAccounts(
  accessToken: string,
  qbConnectionId: string,
): Promise<unknown> {
  const res = await savetrixPost<{ data?: unknown }>("/quickbooks/accounts/sync", {}, accessToken, qbConnectionId);
  return res.data?.data ?? res.data;
}

// POST /quickbooks/taxcodes/sync — pulls the latest tax codes from QuickBooks
// into the app's local store. Non-destructive. Mirrors savetrix_taxcode_sync.
export async function syncTaxCodes(
  accessToken: string,
  qbConnectionId: string,
): Promise<unknown> {
  const res = await savetrixPost<{ data?: unknown }>("/quickbooks/taxcodes/sync", {}, accessToken, qbConnectionId);
  return res.data?.data ?? res.data;
}

// ── dispatcher ───────────────────────────────────────────────────────────

export const TOOL_NAMES = [
  "list_invoices",
  "get_invoice_detail",
  "summarize_spend",
  "list_vendors",
  "list_gl_accounts",
  "list_tax_codes",
  // ── write tools ────────────────────────────────────────────────────────────
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
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

// Every branch is caught individually so one failed Savetrix call becomes a
// plain-language tool result the model can relay ("couldn't find that"),
// never a crash of the whole streaming response.
/**
 * Per-request salt for consent token signing. Prevents token reuse across
 * different API calls. Derived from accessToken + timestamp for uniqueness.
 */
function deriveRequestSalt(accessToken: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  return `${accessToken.slice(0, 16)}:${timestamp}`;
}

/**
 * Wrapper for destructive-action confirmation gates. Handles both legacy
 * confirm flag and new token-based confirmation. Returns { ok: true } if
 * confirmed, or a rejection response with minted token if needed.
 */
function gateConfirmation(
  args: { confirm?: boolean; confirmationToken?: string },
  toolName: string,
  action: string,
  requestSalt: string,
): ConfirmGateResult & { success?: false; confirmationRequired?: boolean } {
  const gate = requireConfirm(args, action, toolName, requestSalt);
  if (gate.ok) return { ok: true };
  // Return rejection in the same format as tool functions.
  return {
    ok: false,
    message: gate.message ?? `Action "${action}" requires confirmation.`,
    success: false,
    confirmationRequired: true,
    confirmationToken: gate.confirmationToken,
  };
}

export async function callTool(
  name: string,
  args: Record<string, unknown>,
  accessToken: string,
  qbConnectionId: string,
): Promise<unknown> {
  const requestSalt = deriveRequestSalt(accessToken);
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
      // ── write tools ───────────────────────────────────────────────────────
      case "update_invoice":
          return await updateInvoice(accessToken, qbConnectionId, args as unknown as UpdateInvoiceArgs & { confirm?: boolean; confirmationToken?: string }, requestSalt);
        case "post_invoice_to_qb":
          return await postInvoiceToQuickBooks(accessToken, qbConnectionId, args as unknown as PostInvoiceToQbArgs, requestSalt);
        case "reject_invoice":
          return await rejectInvoice(accessToken, qbConnectionId, args as unknown as RejectInvoiceArgs, requestSalt);
        case "create_vendor":
          return await createVendor(accessToken, qbConnectionId, args as unknown as CreateVendorArgs);
        case "update_vendor":
          return await updateVendor(accessToken, qbConnectionId, args as unknown as UpdateVendorArgs);
        case "deactivate_vendor":
          return await deactivateVendor(accessToken, qbConnectionId, args as unknown as DeactivateVendorArgs, requestSalt);
        case "reactivate_vendor":
          return await reactivateVendor(accessToken, qbConnectionId, args as unknown as ReactivateVendorArgs);
        case "create_gl_account":
          return await createGLAccount(accessToken, qbConnectionId, args as unknown as CreateGLAccountArgs);
        case "sync_accounts":
          return await syncGLAccounts(accessToken, qbConnectionId);
        case "sync_tax_codes":
          return await syncTaxCodes(accessToken, qbConnectionId);
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    // Surface backend errors as plain-language text the model can relay —
    // never a crash of the whole streaming response. Destructive-action
    // errors (e.g. a failed post) should tell the user what went wrong.
    return { success: false, message: msg };
  }
}
