"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpDown, ChevronRight, FileX2, Search, X } from "lucide-react";
import { ReactNode, useEffect, useMemo, useState } from "react";

import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { getInvoices } from "@/store/invoice/invoiceApi";
import { setSelectedInvoice } from "@/store/invoice/invoiceSlice";
import type { InvoiceRecord } from "@/store/invoice/invoiceSlice";
import type { GLAccount, TaxCode } from "@/store/quickBooks/quickBooksSlice";
import { taxCodeId, taxCodeName } from "@/lib/quickbooks/taxCode";
import {
  INVOICE_STATUS_THEME,
  InvoiceStatusTheme,
  getInvoiceAmount,
  getInvoiceFailureReason,
  getInvoicePostedDate,
  getInvoiceStatus,
  getInvoiceTitle,
  getUserDisplayName,
} from "@/lib/invoiceDisplay";
import { formatDetailAmount, formatDetailDate, safeDetailValue } from "@/lib/invoiceDetailTheme";
import { ErrorState } from "@/components/ui/ErrorState";
import { SkeletonListRows } from "@/components/ui/Skeleton";
import { OutcomeMixCard } from "@/components/invoices/OutcomeMixCard";
import { TopVendorsCard } from "@/components/invoices/TopVendorsCard";

type ListType = "auto" | "manual" | "failed";
type StatusFilter = "all" | ListType;
type ConfidenceFilter = "all" | "high" | "medium" | "low";

const STATUS_ORDER: StatusFilter[] = ["all", "auto", "manual", "failed"];
const TAB_ORDER: ListType[] = ["auto", "manual", "failed"];

const STATUS_META: Record<StatusFilter, { label: string; emptyMessage: string }> = {
  all: {
    label: "All",
    emptyMessage: "No invoices yet. Scanned invoices will appear here.",
  },
  auto: {
    label: "Auto-Posted",
    emptyMessage: "No auto-posted invoices yet. Invoices with high confidence will appear here.",
  },
  manual: {
    label: "Manually Posted",
    emptyMessage: "No manually posted invoices yet. Reviewed invoices will appear here.",
  },
  failed: {
    label: "Failed",
    emptyMessage: "No failed invoices. Invoices that couldn't be processed will appear here.",
  },
};

const CONFIDENCE_BANDS: Record<Exclude<ConfidenceFilter, "all">, { label: string; test: (score: number) => boolean }> = {
  high: { label: "High (90%+)", test: (score) => score >= 90 },
  medium: { label: "Medium (70–89%)", test: (score) => score >= 70 && score < 90 },
  low: { label: "Low (<70%)", test: (score) => score < 70 },
};

const SORT_OPTIONS: { by: "date" | "amount"; dir: "asc" | "desc"; label: string }[] = [
  { by: "date", dir: "desc", label: "Newest first" },
  { by: "date", dir: "asc", label: "Oldest first" },
  { by: "amount", dir: "desc", label: "Amount: high to low" },
  { by: "amount", dir: "asc", label: "Amount: low to high" },
];

function isListType(value: string | null): value is ListType {
  return value === "auto" || value === "manual" || value === "failed";
}

function isStatusFilter(value: string | null): value is StatusFilter {
  return value === "all" || isListType(value);
}

function invoiceTimestamp(invoice: InvoiceRecord): number {
  const history = invoice.statusHistory;
  const latest = history && history.length > 0 ? history[history.length - 1] : undefined;
  const dateStr = latest?.changedAt || invoice.extractedData?.invoiceDate || invoice.createdAt;
  if (!dateStr) return 0;
  const parsed = new Date(dateStr).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function vendorInitials(invoice: InvoiceRecord): string {
  const name = (invoice.extractedData?.vendorName || invoice.file?.originalName || "").trim();
  return name ? name.slice(0, 2).toUpperCase() : "?";
}

function sumAndCurrency(list: InvoiceRecord[]): { total: number; currency: string } {
  const total = list.reduce((sum, invoice) => sum + (invoice.extractedData?.totalAmount || 0), 0);
  const currency = list.find((invoice) => invoice.extractedData?.currency)?.extractedData?.currency || "";
  return { total, currency };
}

function formatTotal({ total, currency }: { total: number; currency: string }): string {
  return `${currency} ${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}`.trim();
}

function DetailField({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  if (value === "—") return null;
  return (
    <div className="flex items-start justify-between gap-[var(--space-sm)] py-[6px]">
      <span className="shrink-0 text-caption text-text-secondary">{label}</span>
      <span
        className={`text-right font-semibold text-text-primary ${emphasize ? "text-body-sm" : "text-caption"}`}
      >
        {value}
      </span>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-caption font-bold uppercase tracking-wide text-text-secondary">{title}</p>
      <div className="mt-[var(--space-xs)] divide-y divide-border">{children}</div>
    </div>
  );
}

// Full inline preview shown in the right-hand panel when a row is selected —
// reads the same InvoiceRecord already loaded for the list (no extra
// fetch, unlike the full detail page's own getInvoiceDetails call). "Open
// full page" is still the escape hatch for actions this panel doesn't do
// (reject/repost, viewing the original document).
function SelectedInvoiceCard({
  invoice,
  theme,
  glAccounts,
  taxCodes,
  onViewFullDetails,
  onClose,
}: {
  invoice: InvoiceRecord;
  theme: InvoiceStatusTheme;
  glAccounts: GLAccount[];
  taxCodes: TaxCode[];
  onViewFullDetails: () => void;
  onClose: () => void;
}) {
  const data = invoice.extractedData;
  const currency = data?.currency || "";
  const confidence = invoice.confidenceScore != null ? `${Math.round(Number(invoice.confidenceScore))}%` : null;
  const failureReason = getInvoiceFailureReason(invoice);
  const statusHistory = invoice.statusHistory ?? [];
  const lineItems = data?.lineItems ?? [];

  const resolvedGlAccount = glAccounts.find((account) => account.qbAccountId === String(data?.glAccountId ?? ""));
  const resolvedTaxCode = taxCodes.find((code) => taxCodeId(code) === String(data?.taxCodeId ?? ""));

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-white">
      <div className="flex items-center justify-between gap-[var(--space-sm)] bg-primary-900 px-[var(--space-md)] py-[var(--space-sm)]">
        <span className="text-caption font-bold uppercase tracking-wide text-primary-200">Selected invoice</span>
        <button type="button" onClick={onClose} aria-label="Close" className="text-primary-200 hover:text-white">
          <X size={16} strokeWidth={2.5} />
        </button>
      </div>

      <div className="p-[var(--space-md)]">
        <div className="flex items-center gap-[var(--space-sm)]">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-caption font-bold ${theme.cardBgClass} ${theme.accentTextClass}`}
          >
            {vendorInitials(invoice)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-bold text-text-primary">{getInvoiceTitle(invoice)}</p>
            <span
              className={`mt-[2px] inline-flex rounded-pill px-[var(--space-sm)] py-[1px] text-caption font-bold ${theme.badgeClass}`}
            >
              {theme.label}
            </span>
          </div>
        </div>

        <div className="mt-[var(--space-md)] rounded-md bg-background-soft p-[var(--space-sm)]">
          <p className="text-caption uppercase tracking-wide text-text-secondary">Total amount</p>
          <p className="text-h3 font-bold text-text-primary">{formatDetailAmount(data?.totalAmount, currency)}</p>
        </div>

        {confidence && (
          <div className="mt-[var(--space-sm)] flex items-center justify-between text-body-sm">
            <span className="text-text-secondary">Confidence</span>
            <span className="font-semibold text-text-primary">{confidence}</span>
          </div>
        )}

        {failureReason && (
          <div className="mt-[var(--space-sm)] rounded-md border-l-4 border-error bg-error/10 px-[var(--space-sm)] py-[var(--space-xs)] text-caption font-medium text-error">
            {failureReason}
          </div>
        )}

        <div className="mt-[var(--space-md)] flex flex-col gap-[var(--space-md)]">
          <DetailSection title="Invoice">
            <DetailField label="Invoice #" value={safeDetailValue(data?.invoiceNumber)} />
            <DetailField label="Invoice date" value={formatDetailDate(data?.invoiceDate)} />
            <DetailField label="Due date" value={formatDetailDate(data?.dueDate)} />
            <DetailField label="Currency" value={safeDetailValue(currency)} />
            <DetailField label="GL account" value={safeDetailValue(resolvedGlAccount?.name)} />
            <DetailField label="Tax code" value={safeDetailValue(resolvedTaxCode ? taxCodeName(resolvedTaxCode) : undefined)} />
          </DetailSection>

          <DetailSection title="Financials">
            <DetailField label="Before tax" value={formatDetailAmount(data?.amountBeforeTax, currency)} />
            <DetailField label="Tax" value={formatDetailAmount(data?.taxAmount, currency)} />
            <DetailField label="Total" value={formatDetailAmount(data?.totalAmount, currency)} emphasize />
          </DetailSection>

          {(data?.vendorAddress || data?.bankingDetails) && (
            <DetailSection title="Vendor">
              <DetailField label="Address" value={safeDetailValue(data?.vendorAddress)} />
              <DetailField label="Bank details" value={safeDetailValue(data?.bankingDetails)} />
            </DetailSection>
          )}

          {data?.description && (
            <DetailSection title="Description">
              <p className="whitespace-pre-line py-[6px] text-caption text-text-primary">{data.description}</p>
            </DetailSection>
          )}

          {lineItems.length > 0 && (
            <DetailSection title={`Line items (${lineItems.length})`}>
              {lineItems.map((item, index) => (
                <div key={index} className="flex items-center justify-between gap-[var(--space-sm)] py-[6px]">
                  <span className="min-w-0 truncate text-caption text-text-primary">{item.description}</span>
                  <span className="shrink-0 text-caption font-semibold text-text-primary">
                    {formatDetailAmount(item.amount)}
                  </span>
                </div>
              ))}
            </DetailSection>
          )}

          {statusHistory.length > 0 && (
            <DetailSection title="History">
              {statusHistory.map((entry, index) => {
                const changedByName = getUserDisplayName(entry.changedBy);
                return (
                  <div key={index} className="flex items-center justify-between gap-[var(--space-sm)] py-[6px]">
                    <span className="min-w-0 truncate text-caption font-semibold text-text-primary">
                      {entry.postedStatus ? entry.postedStatus.charAt(0).toUpperCase() + entry.postedStatus.slice(1) : "—"}
                      {changedByName && <span className="font-normal text-text-secondary"> · By {changedByName}</span>}
                    </span>
                    <span className="shrink-0 text-caption text-text-secondary">{formatDetailDate(entry.changedAt)}</span>
                  </div>
                );
              })}
            </DetailSection>
          )}
        </div>

        <button
          type="button"
          onClick={onViewFullDetails}
          className="mt-[var(--space-md)] w-full rounded-pill bg-primary px-[var(--space-md)] py-[var(--space-sm)] text-center text-body-sm font-bold text-text-primary hover:opacity-90"
        >
          Open full page
        </button>
      </div>
    </div>
  );
}

export function InvoiceListContent() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();

  const typeParam = searchParams.get("type");
  const statusFilter: StatusFilter = isStatusFilter(typeParam) ? typeParam : "all";

  const { invoices: allInvoices, autoPostedInvoices, manualPostedInvoices, failedInvoices, loading, error } =
    useAppSelector((state) => state.invoice);
  const qbConnectionId = useAppSelector((state) => state.quickBooks.qbConnectionId);
  const glAccounts = useAppSelector((state) => state.quickBooks.accounts);
  const taxCodes = useAppSelector((state) => state.quickBooks.taxCodes);

  const [searchText, setSearchText] = useState("");
  const [sortIndex, setSortIndex] = useState(0);
  const [vendorFilter, setVendorFilter] = useState("all");
  const [currencyFilter, setCurrencyFilter] = useState("all");
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>("all");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const sort = SORT_OPTIONS[sortIndex];

  const refetch = () => {
    dispatch(getInvoices());
  };

  // Depends on qbConnectionId (not just mount) so switching companies in the
  // top bar re-fetches for the new entity instead of leaving the previous
  // one's invoices on screen until a manual reload. Guarded on qbConnectionId
  // being set since right after login it's briefly blank — see
  // DashboardContent's identical guard for why firing earlier 400s.
  useEffect(() => {
    if (!qbConnectionId) return;
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qbConnectionId]);

  // Clears a leftover search/selection when switching status — a match (or
  // a selected row) from a different status has no bearing on this one.
  useEffect(() => {
    setSearchText("");
    setSelectedInvoiceId(null);
  }, [statusFilter]);

  const combinedInvoices = useMemo(
    () => [...autoPostedInvoices, ...manualPostedInvoices, ...failedInvoices],
    [autoPostedInvoices, manualPostedInvoices, failedInvoices],
  );

  const statusFilteredInvoices: InvoiceRecord[] = useMemo(() => {
    if (statusFilter === "all") return combinedInvoices;
    if (statusFilter === "auto") return autoPostedInvoices;
    if (statusFilter === "manual") return manualPostedInvoices;
    return failedInvoices;
  }, [statusFilter, combinedInvoices, autoPostedInvoices, manualPostedInvoices, failedInvoices]);

  const vendorOptions = useMemo(() => {
    const names = new Set<string>();
    combinedInvoices.forEach((invoice) => {
      const name = invoice.extractedData?.vendorName?.trim();
      if (name) names.add(name);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [combinedInvoices]);

  const currencyOptions = useMemo(() => {
    const currencies = new Set<string>();
    combinedInvoices.forEach((invoice) => {
      const currency = invoice.extractedData?.currency?.trim();
      if (currency) currencies.add(currency);
    });
    return Array.from(currencies).sort();
  }, [combinedInvoices]);

  const filteredInvoices = useMemo(() => {
    let list = statusFilteredInvoices;

    if (vendorFilter !== "all") {
      list = list.filter((invoice) => invoice.extractedData?.vendorName === vendorFilter);
    }
    if (currencyFilter !== "all") {
      list = list.filter((invoice) => invoice.extractedData?.currency === currencyFilter);
    }
    if (confidenceFilter !== "all") {
      const band = CONFIDENCE_BANDS[confidenceFilter];
      list = list.filter((invoice) => invoice.confidenceScore != null && band.test(Number(invoice.confidenceScore)));
    }

    const query = searchText.trim().toLowerCase();
    if (query) {
      list = list.filter((invoice) => {
        const vendor = invoice.extractedData?.vendorName?.toLowerCase() || "";
        const number = invoice.extractedData?.invoiceNumber?.toLowerCase() || "";
        const amount = String(invoice.extractedData?.totalAmount ?? "");
        return vendor.includes(query) || number.includes(query) || amount.includes(query);
      });
    }

    return [...list].sort((a, b) => {
      const aValue = sort.by === "amount" ? a.extractedData?.totalAmount || 0 : invoiceTimestamp(a);
      const bValue = sort.by === "amount" ? b.extractedData?.totalAmount || 0 : invoiceTimestamp(b);
      return sort.dir === "asc" ? aValue - bValue : bValue - aValue;
    });
  }, [statusFilteredInvoices, vendorFilter, currencyFilter, confidenceFilter, searchText, sort]);

  const handleOpenFullDetails = (invoice: InvoiceRecord) => {
    dispatch(setSelectedInvoice(invoice));
    router.push(`/invoices/${invoice._id}${statusFilter !== "all" ? `?type=${statusFilter}` : ""}`);
  };

  const selectedInvoice = selectedInvoiceId
    ? statusFilteredInvoices.find((invoice) => invoice._id === selectedInvoiceId) || null
    : null;

  const tabCounts: Record<ListType, number> = {
    auto: autoPostedInvoices.length,
    manual: manualPostedInvoices.length,
    failed: failedInvoices.length,
  };

  const totals = useMemo(
    () => ({
      total: sumAndCurrency(combinedInvoices),
      auto: sumAndCurrency(autoPostedInvoices),
      manual: sumAndCurrency(manualPostedInvoices),
      failed: sumAndCurrency(failedInvoices),
    }),
    [combinedInvoices, autoPostedInvoices, manualPostedInvoices, failedInvoices],
  );

  const meta = STATUS_META[statusFilter];

  return (
    <div className="mx-auto max-w-6xl p-[var(--space-lg)]">
      <div className="grid grid-cols-1 gap-[var(--space-lg)] lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className="flex flex-col gap-[var(--space-md)]">
          {/* Stat tiles — real dollar totals per status, doubling as status
              shortcuts (matches the old StatRow cards' click-to-switch
              behavior, plus a dark "Total" hero tile across all three). */}
          <div className="grid grid-cols-2 gap-[var(--space-sm)] sm:grid-cols-4">
            <div className="rounded-lg bg-primary-900 p-[var(--space-md)] text-white">
              <p className="text-caption font-semibold uppercase tracking-wide text-primary-200">Total</p>
              <p className="mt-[var(--space-xs)] text-h2 font-bold">{formatTotal(totals.total)}</p>
              <p className="mt-[var(--space-xs)] text-caption text-primary-200">
                {combinedInvoices.length} invoice{combinedInvoices.length === 1 ? "" : "s"}
              </p>
            </div>
            {TAB_ORDER.map((t) => {
              const tileTheme = INVOICE_STATUS_THEME[t];
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => router.replace(`/invoices?type=${t}`)}
                  className={`rounded-lg p-[var(--space-md)] text-left ${tileTheme.cardBgClass}`}
                >
                  <p className={`text-caption font-semibold uppercase tracking-wide ${tileTheme.accentTextClass}`}>
                    {tileTheme.label}
                  </p>
                  <p className={`mt-[var(--space-xs)] text-h2 font-bold ${tileTheme.accentTextClass}`}>
                    {formatTotal(totals[t])}
                  </p>
                  <p className={`mt-[var(--space-xs)] text-caption ${tileTheme.accentTextClass}`}>
                    {tabCounts[t]} invoice{tabCounts[t] === 1 ? "" : "s"}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="rounded-lg border border-border bg-white">
            {/* Filter bar */}
            <div className="flex flex-wrap items-center gap-[var(--space-sm)] border-b border-border p-[var(--space-md)]">
              <select
                value={statusFilter}
                onChange={(event) => router.replace(`/invoices?type=${event.target.value}`)}
                className="rounded-pill border border-border bg-white px-[var(--space-md)] py-[var(--space-xs)] text-body-sm font-semibold text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    Status: {STATUS_META[s].label}
                  </option>
                ))}
              </select>

              <select
                value={vendorFilter}
                onChange={(event) => setVendorFilter(event.target.value)}
                className="max-w-[160px] rounded-pill border border-border bg-white px-[var(--space-md)] py-[var(--space-xs)] text-body-sm font-semibold text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="all">Vendor: All</option>
                {vendorOptions.map((vendor) => (
                  <option key={vendor} value={vendor}>
                    {vendor}
                  </option>
                ))}
              </select>

              <select
                value={currencyFilter}
                onChange={(event) => setCurrencyFilter(event.target.value)}
                className="rounded-pill border border-border bg-white px-[var(--space-md)] py-[var(--space-xs)] text-body-sm font-semibold text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="all">Currency: All</option>
                {currencyOptions.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>

              <select
                value={confidenceFilter}
                onChange={(event) => setConfidenceFilter(event.target.value as ConfidenceFilter)}
                className="rounded-pill border border-border bg-white px-[var(--space-md)] py-[var(--space-xs)] text-body-sm font-semibold text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="all">Confidence: All</option>
                {(Object.keys(CONFIDENCE_BANDS) as Exclude<ConfidenceFilter, "all">[]).map((band) => (
                  <option key={band} value={band}>
                    {CONFIDENCE_BANDS[band].label}
                  </option>
                ))}
              </select>

              <div className="ml-auto flex flex-wrap items-center gap-[var(--space-sm)]">
                <label className="flex items-center gap-[var(--space-xs)] rounded-pill bg-background-alt px-[var(--space-md)] py-[var(--space-xs)]">
                  <Search size={14} strokeWidth={2.25} className="shrink-0 text-text-secondary" />
                  <input
                    type="text"
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    placeholder="Search vendor, invoice #, amount"
                    className="w-40 bg-transparent text-body-sm text-text-primary outline-none placeholder:text-text-secondary sm:w-56"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setSortIndex((i) => (i + 1) % SORT_OPTIONS.length)}
                  className="flex shrink-0 items-center gap-[var(--space-xs)] rounded-pill border border-border px-[var(--space-md)] py-[var(--space-xs)] text-body-sm font-semibold text-text-secondary hover:bg-background-alt"
                >
                  <ArrowUpDown size={14} strokeWidth={2.25} />
                  {sort.label}
                </button>
              </div>
            </div>

            {/* Table header */}
            {!loading && !error && statusFilteredInvoices.length > 0 && (
              <div className="grid grid-cols-[40px_2fr_1fr_1fr_1fr_24px] gap-[var(--space-sm)] px-[var(--space-md)] pb-[var(--space-sm)] pt-[var(--space-md)] text-caption font-bold uppercase tracking-wide text-text-secondary">
                <span />
                <span>Vendor / Invoice</span>
                <span>Received</span>
                <span>Status</span>
                <span className="text-right">Amount</span>
                <span />
              </div>
            )}

            {loading ? (
              <div className="p-[var(--space-md)]">
                <SkeletonListRows count={4} />
              </div>
            ) : error ? (
              <div className="p-[var(--space-md)]">
                <ErrorState message="Couldn't load these invoices." onRetry={refetch} />
              </div>
            ) : statusFilteredInvoices.length === 0 ? (
              <div className="flex flex-col items-center py-[var(--space-xl)] text-center">
                <span className="mb-[var(--space-md)] flex h-24 w-24 items-center justify-center rounded-full bg-background-alt">
                  <FileX2 size={40} strokeWidth={1.5} className="text-text-secondary" />
                </span>
                <p className="text-h3 font-extrabold text-text-primary">No invoices found</p>
                <p className="mt-[var(--space-xs)] max-w-sm text-body-sm text-text-secondary">{meta.emptyMessage}</p>
              </div>
            ) : filteredInvoices.length === 0 ? (
              <div className="flex flex-col items-center py-[var(--space-xl)] text-center">
                <p className="font-bold text-text-primary">No invoices match these filters</p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchText("");
                    setVendorFilter("all");
                    setCurrencyFilter("all");
                    setConfidenceFilter("all");
                  }}
                  className="mt-[var(--space-sm)] text-body-sm font-semibold text-primary-700"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div>
                {filteredInvoices.map((invoice) => {
                  const rowTheme = INVOICE_STATUS_THEME[getInvoiceStatus(invoice.postedStatus)];
                  const failureReason = getInvoiceFailureReason(invoice);
                  const confidence =
                    invoice.confidenceScore != null ? `${Math.round(Number(invoice.confidenceScore))}%` : null;
                  const isSelected = invoice._id === selectedInvoiceId;
                  return (
                    <button
                      key={invoice._id}
                      type="button"
                      onClick={() => setSelectedInvoiceId(invoice._id)}
                      className={`grid w-full grid-cols-[40px_2fr_1fr_1fr_1fr_24px] items-center gap-[var(--space-sm)] border-b border-border px-[var(--space-md)] py-[var(--space-sm)] text-left last:border-b-0 ${
                        isSelected ? "bg-primary-50" : "hover:bg-background-alt"
                      }`}
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-caption font-bold ${rowTheme.cardBgClass} ${rowTheme.accentTextClass}`}
                      >
                        {vendorInitials(invoice)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-text-primary">
                          {getInvoiceTitle(invoice)}
                        </span>
                        {failureReason ? (
                          <span className="block truncate text-caption text-error">{failureReason}</span>
                        ) : confidence ? (
                          <span className="block truncate text-caption text-text-secondary">
                            {confidence} confidence
                          </span>
                        ) : null}
                      </span>
                      <span className="text-body-sm text-text-secondary">{getInvoicePostedDate(invoice)}</span>
                      <span>
                        <span
                          className={`inline-flex w-fit items-center rounded-pill px-[var(--space-sm)] py-[2px] text-caption font-bold ${rowTheme.badgeClass}`}
                        >
                          {rowTheme.label}
                        </span>
                      </span>
                      <span className="text-right font-bold text-text-primary">{getInvoiceAmount(invoice)}</span>
                      <ChevronRight size={18} strokeWidth={2} className="shrink-0 justify-self-end text-text-secondary" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <aside className="flex flex-col gap-[var(--space-md)]">
          {selectedInvoice ? (
            <SelectedInvoiceCard
              invoice={selectedInvoice}
              theme={INVOICE_STATUS_THEME[getInvoiceStatus(selectedInvoice.postedStatus)]}
              glAccounts={glAccounts}
              taxCodes={taxCodes}
              onViewFullDetails={() => handleOpenFullDetails(selectedInvoice)}
              onClose={() => setSelectedInvoiceId(null)}
            />
          ) : (
            <>
              <OutcomeMixCard invoices={combinedInvoices} />
              <TopVendorsCard invoices={allInvoices} />
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
