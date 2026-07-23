// Per-status theming for the invoice detail page, ported verbatim (hex
// values) from Scantrix_v2 src/screens/invoice/InvoiceDetailsScreen.tsx's
// THEME_CONFIG. Distinct from src/lib/invoiceDisplay.ts's simpler
// INVOICE_STATUS_THEME (used for lists/dashboard) — this screen has more
// per-status surfaces (section headers, dividers, timeline accents) than
// that shared theme carries.
export type InvoiceDetailType = "auto" | "manual" | "failed";

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
};

export function isInvoiceDetailType(value: string | null): value is InvoiceDetailType {
  return value === "auto" || value === "manual" || value === "failed";
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
