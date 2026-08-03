// Real spend-by-vendor computed client-side from whatever invoices are
// already loaded — no backend endpoint for this exists. Shared between
// DashboardContent and InvoiceListContent so both surfaces derive the same
// numbers instead of each keeping its own copy.
import type { InvoiceRecord } from "@/store/invoice/invoiceSlice";

export interface VendorTotal {
  vendor: string;
  total: number;
  currency: string;
}

export interface TopVendorsResult {
  vendors: VendorTotal[];
  scopedToMonth: boolean;
}

const MIN_TOP_VENDORS = 3;
const MAX_TOP_VENDORS = 4;

function buildVendorTotals(
  invoices: InvoiceRecord[],
  monthStart: Date | null,
): Map<string, { total: number; currency: string }> {
  const totals = new Map<string, { total: number; currency: string }>();
  for (const invoice of invoices) {
    if (monthStart) {
      const dateStr = invoice.extractedData?.invoiceDate || invoice.createdAt;
      if (!dateStr) continue;
      const invoiceDate = new Date(dateStr);
      if (Number.isNaN(invoiceDate.getTime()) || invoiceDate < monthStart) continue;
    }

    const vendor = invoice.extractedData?.vendorName?.trim();
    if (!vendor) continue;

    const amount = invoice.extractedData?.totalAmount || 0;
    const existing = totals.get(vendor);
    if (existing) existing.total += amount;
    else totals.set(vendor, { total: amount, currency: invoice.extractedData?.currency || "" });
  }
  return totals;
}

// This month alone doesn't have enough distinct vendors to fill the widget
// — widen to all-time totals instead of showing a sparse list, as long as
// doing so actually surfaces more vendors.
export function computeTopVendors(invoices: InvoiceRecord[]): TopVendorsResult {
  // Only spend that actually posted (auto or manual) counts as real vendor
  // spend — pending/processing isn't confirmed yet and failed never posted,
  // so neither belongs in a "top vendors" total.
  const postedInvoices = invoices.filter(
    (invoice) => invoice.postedStatus === "auto" || invoice.postedStatus === "manual",
  );

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  let totals = buildVendorTotals(postedInvoices, monthStart);
  let scopedToMonth = true;

  if (totals.size < MIN_TOP_VENDORS) {
    const allTimeTotals = buildVendorTotals(postedInvoices, null);
    if (allTimeTotals.size > totals.size) {
      totals = allTimeTotals;
      scopedToMonth = false;
    }
  }

  return {
    vendors: [...totals.entries()]
      .map(([vendor, data]) => ({ vendor, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, MAX_TOP_VENDORS),
    scopedToMonth,
  };
}
