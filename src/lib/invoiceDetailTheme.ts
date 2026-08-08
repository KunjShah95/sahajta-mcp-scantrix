// Per-status theming for the invoice detail page, ported verbatim (hex
// values) from Scantrix_v2 src/screens/invoice/InvoiceDetailsScreen.tsx's
// THEME_CONFIG. Distinct from src/lib/invoiceDisplay.ts's simpler
// INVOICE_STATUS_THEME (used for lists/dashboard) — this screen has more
// per-status surfaces (section headers, dividers, timeline accents) than
// that shared theme carries.
export type InvoiceDetailType = "auto" | "manual" | "pending" | "failed";

export interface InvoiceDetailTheme {
  headerBg: string;
  screenBg: string;
  cardBg: string;
  sectionHeaderBg: string;
  accentColor: string;
  labelColor: string;
  valueColor: string;
  pillBg: string;
  pillText: string;
  divider: string;
  statusLabel: string;
}

export const INVOICE_DETAIL_THEME: Record<InvoiceDetailType, InvoiceDetailTheme> = {
  auto: {
    headerBg: "#21A77A",
    screenBg: "#F6FAF8",
    cardBg: "#DDF3E8",
    sectionHeaderBg: "#EBF7F3",
    accentColor: "#21A77A",
    labelColor: "#15805D",
    valueColor: "#1E7D5C",
    pillBg: "#DDF3E8",
    pillText: "#15805D",
    divider: "#D4EFE3",
    statusLabel: "Auto-Posted",
  },
  manual: {
    headerBg: "#EDA320",
    screenBg: "#FEFBF5",
    cardBg: "#F8EBD4",
    sectionHeaderBg: "#FBF2E3",
    accentColor: "#EDA320",
    labelColor: "#9F6807",
    valueColor: "#A06707",
    pillBg: "#F8EBD4",
    pillText: "#9F6807",
    divider: "#F3D6A4",
    statusLabel: "Manually Posted",
  },
  failed: {
    headerBg: "#E74949",
    screenBg: "#FFF8F8",
    cardBg: "#F9E3E5",
    sectionHeaderBg: "#FDEDEF",
    accentColor: "#E74949",
    labelColor: "#A12832",
    valueColor: "#C9363C",
    pillBg: "#F9E3E5",
    pillText: "#A12832",
    divider: "#F3C8CD",
    statusLabel: "Failed",
  },
  // Matches src/lib/invoiceDisplay.ts's INVOICE_STATUS_THEME.pending accent
  // (--color-trust-navy, #1f3a5f) for cross-page consistency. Used whenever
  // an invoice's real postedStatus isn't auto/manual/failed (pending,
  // processing, or anything unrecognized) — see resolveInvoiceDetailType.
  pending: {
    headerBg: "#1F3A5F",
    screenBg: "#F5F8FB",
    cardBg: "#E1EAF5",
    sectionHeaderBg: "#EEF3FA",
    accentColor: "#1F3A5F",
    labelColor: "#13253D",
    valueColor: "#1A3352",
    pillBg: "#E1EAF5",
    pillText: "#13253D",
    divider: "#D6E4F5",
    statusLabel: "Pending",
  },
};

// The invoice's own postedStatus is the source of truth for which badge/
// theme renders here — never a URL query param, which can be absent, stale,
// or simply wrong for the invoice actually being viewed (e.g. a bookmarked
// or directly-navigated link with no ?type=). Any status this page doesn't
// have a dedicated theme for (pending, processing, or unrecognized) safely
// falls back to the neutral "pending" theme rather than ever guessing
// "auto" or "failed".
export function resolveInvoiceDetailType(postedStatus?: string | null): InvoiceDetailType {
  if (postedStatus === "auto" || postedStatus === "manual" || postedStatus === "failed") {
    return postedStatus;
  }
  return "pending";
}

export function safeDetailValue(value?: string | number | null): string {
  if (value === undefined || value === null || value === "") return "—";
  const stringValue = String(value).trim();
  return stringValue || "—";
}

export function formatDetailDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

// Status-history entries carry a real changedAt timestamp (unlike invoiceDate/
// dueDate, which are day-only business dates) — use this wherever a status
// history entry's time is shown, not formatDetailDate.
export function formatDetailDateTime(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDetailAmount(amount?: number | string | null, currency?: string): string {
  if (amount === undefined || amount === null || amount === "") return "—";
  const num = Number(amount);
  if (Number.isNaN(num)) return String(amount);
  const formatted = num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency ? `${currency} ${formatted}` : formatted;
}

interface InvoiceUrlLike {
  s3Url?: string;
  file?: { s3Url?: string; url?: string; fileUrl?: string };
}

export function getDetailInvoiceUrl(invoice: InvoiceUrlLike): string | undefined {
  const candidates = [invoice?.s3Url, invoice?.file?.s3Url, invoice?.file?.url, invoice?.file?.fileUrl];
  return candidates.find((item): item is string => typeof item === "string" && item.trim().length > 0 && item.startsWith("http"));
}
