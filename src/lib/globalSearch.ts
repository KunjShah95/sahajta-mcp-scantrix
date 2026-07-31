// Cross-entity search for the header search bar. There is no backend search
// endpoint (see AGENTS.md) — every list here is already loaded into Redux by
// the pages that use it, so this just filters what's already in memory.
import type { InvoiceRecord } from "@/store/invoice/invoiceSlice";
import type { GLAccount, TaxCode, Vendor } from "@/store/quickBooks/quickBooksSlice";
import { taxCodeId, taxCodeName } from "@/lib/quickbooks/taxCode";
import { INVOICE_STATUS_THEME, getInvoiceAmount, getInvoiceStatus, getInvoiceTitle } from "@/lib/invoiceDisplay";

export type SearchResultCategory = "invoice" | "vendor" | "glAccount" | "taxCode";

export interface SearchResult {
  id: string;
  category: SearchResultCategory;
  categoryLabel: string;
  title: string;
  subtitle?: string;
  href: string;
}

export const SEARCH_CATEGORY_LABELS: Record<SearchResultCategory, string> = {
  invoice: "Invoices",
  vendor: "Vendors",
  glAccount: "GL Accounts",
  taxCode: "Tax Codes",
};

// Keeps the dropdown scannable even when a query matches dozens of rows in
// one category.
const MAX_RESULTS_PER_CATEGORY = 5;

export interface SearchSources {
  invoices: InvoiceRecord[];
  vendors: Vendor[];
  accounts: GLAccount[];
  taxCodes: TaxCode[];
}

function matches(value: string | null | undefined, query: string): boolean {
  return !!value && value.toLowerCase().includes(query);
}

export function searchAll(query: string, sources: SearchSources): SearchResult[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];

  const invoiceResults: SearchResult[] = sources.invoices
    .filter(
      (invoice) =>
        matches(invoice.extractedData?.vendorName, trimmed) ||
        matches(invoice.extractedData?.invoiceNumber, trimmed) ||
        matches(invoice.file?.originalName, trimmed),
    )
    .slice(0, MAX_RESULTS_PER_CATEGORY)
    .map((invoice) => ({
      id: invoice._id,
      category: "invoice" as const,
      categoryLabel: SEARCH_CATEGORY_LABELS.invoice,
      title: getInvoiceTitle(invoice),
      subtitle: [getInvoiceAmount(invoice), INVOICE_STATUS_THEME[getInvoiceStatus(invoice.postedStatus)].label]
        .filter(Boolean)
        .join(" · "),
      href: `/invoices/${invoice._id}`,
    }));

  const vendorResults: SearchResult[] = sources.vendors
    .filter(
      (vendor) =>
        matches(vendor.displayName, trimmed) ||
        matches(vendor.normalizedName, trimmed) ||
        matches(vendor.email, trimmed) ||
        matches(vendor.phone, trimmed),
    )
    .slice(0, MAX_RESULTS_PER_CATEGORY)
    .map((vendor) => ({
      id: vendor._id,
      category: "vendor" as const,
      categoryLabel: SEARCH_CATEGORY_LABELS.vendor,
      title: vendor.displayName,
      subtitle: vendor.email || vendor.phone || undefined,
      href: "/vendors",
    }));

  const accountResults: SearchResult[] = sources.accounts
    .filter(
      (account) =>
        matches(account.name, trimmed) ||
        matches(account.accountType, trimmed) ||
        matches(account.accountSubType, trimmed),
    )
    .slice(0, MAX_RESULTS_PER_CATEGORY)
    .map((account) => ({
      id: account._id,
      category: "glAccount" as const,
      categoryLabel: SEARCH_CATEGORY_LABELS.glAccount,
      title: account.name,
      subtitle: [account.accountType, account.accountSubType].filter(Boolean).join(" · ") || undefined,
      href: "/gl-tax-codes",
    }));

  const taxCodeResults: SearchResult[] = sources.taxCodes
    .filter((taxCode) => matches(taxCodeName(taxCode), trimmed) || matches(taxCode.description, trimmed))
    .slice(0, MAX_RESULTS_PER_CATEGORY)
    .map((taxCode) => ({
      id: taxCodeId(taxCode),
      category: "taxCode" as const,
      categoryLabel: SEARCH_CATEGORY_LABELS.taxCode,
      title: taxCodeName(taxCode),
      subtitle: taxCode.description || undefined,
      href: "/gl-tax-codes",
    }));

  return [...invoiceResults, ...vendorResults, ...accountResults, ...taxCodeResults];
}
