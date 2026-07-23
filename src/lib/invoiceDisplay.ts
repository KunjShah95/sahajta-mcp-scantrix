// Shared invoice display helpers, consolidated from what Scantrix_v2 (mobile)
// reimplemented separately per screen (DashboardScreen's THEME_CONFIG/
// getInvoiceTitle/getInvoiceAmount, InvoiceListScreen + InvoiceDetailsScreen's
// own THEME_CONFIG copies, PendingInvoicesScreen's getPrimaryIssue). One
// source of truth here instead of repeating that per-screen drift.

export type InvoiceStatus = "auto" | "manual" | "pending" | "processing" | "failed";

interface InvoiceStatusTheme {
  label: string;
  badgeClass: string;
  cardBgClass: string;
}

export const INVOICE_STATUS_THEME: Record<InvoiceStatus, InvoiceStatusTheme> = {
  auto: { label: "Auto-Posted", badgeClass: "bg-success/10 text-success", cardBgClass: "bg-[#E8F7F1]" },
  manual: { label: "Manually Posted", badgeClass: "bg-warning/10 text-warning", cardBgClass: "bg-[#F8EEDC]" },
  pending: { label: "Pending", badgeClass: "bg-trust-navy/10 text-trust-navy", cardBgClass: "bg-[#E8F1FD]" },
  processing: { label: "Processing", badgeClass: "bg-warning/10 text-warning", cardBgClass: "bg-[#FFF7E6]" },
  failed: { label: "Failed", badgeClass: "bg-error/10 text-error", cardBgClass: "bg-[#F8E7E8]" },
};

export function getInvoiceStatus(status?: string): InvoiceStatus {
  if (status === "auto" || status === "manual" || status === "pending" || status === "processing" || status === "failed") {
    return status;
  }
  return "failed";
}

interface InvoiceLike {
  extractedData?: { vendorName?: string; invoiceNumber?: string; totalAmount?: number; currency?: string };
  file?: { originalName?: string };
  postedStatus?: string;
  statusHistory?: { reason?: string }[];
}

export function getInvoiceTitle(invoice: InvoiceLike): string {
  const vendor = invoice.extractedData?.vendorName;
  const invoiceNumber = invoice.extractedData?.invoiceNumber;
  if (vendor && invoiceNumber) return `${vendor} #${invoiceNumber}`;
  if (vendor) return vendor;
  const originalName = invoice.file?.originalName?.replace(/\.pdf$/i, "").replace(/%20/g, " ");
  return originalName || "Unknown Vendor";
}

export function getInvoiceAmount(invoice: InvoiceLike): string {
  const amount = invoice.extractedData?.totalAmount || 0;
  const currency = invoice.extractedData?.currency || "";
  return `${currency} ${amount}`.trim();
}

export function getInvoiceFailureReason(invoice: InvoiceLike): string {
  if (invoice.postedStatus !== "failed") return "";
  const latest = invoice.statusHistory?.[invoice.statusHistory.length - 1];
  return latest?.reason || "";
}
