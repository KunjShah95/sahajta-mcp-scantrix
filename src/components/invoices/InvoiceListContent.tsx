"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, FileX2 } from "lucide-react";
import { useEffect, useMemo } from "react";

import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { getInvoices } from "@/store/invoice/invoiceApi";
import { setSelectedInvoice } from "@/store/invoice/invoiceSlice";
import type { InvoiceRecord } from "@/store/invoice/invoiceSlice";
import {
  INVOICE_STATUS_THEME,
  getInvoiceAmount,
  getInvoiceFailureReason,
  getInvoicePostedDate,
  getInvoiceTitle,
} from "@/lib/invoiceDisplay";
import { ErrorState } from "@/components/ui/ErrorState";
import { SkeletonListRows } from "@/components/ui/Skeleton";
import { StatRow } from "@/components/invoices/StatRow";

type ListType = "auto" | "manual" | "failed";

const TAB_ORDER: ListType[] = ["auto", "manual", "failed"];

const LIST_META: Record<ListType, { tabLabel: string; emptyMessage: string }> = {
  auto: {
    tabLabel: "Auto-Posted",
    emptyMessage: "No auto-posted invoices yet. Invoices with high confidence will appear here.",
  },
  manual: {
    tabLabel: "Manually Posted",
    emptyMessage: "No manually posted invoices yet. Reviewed invoices will appear here.",
  },
  failed: {
    tabLabel: "Failed",
    emptyMessage: "No failed invoices. Invoices that couldn't be processed will appear here.",
  },
};

function isListType(value: string | null): value is ListType {
  return value === "auto" || value === "manual" || value === "failed";
}

export function InvoiceListContent() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();

  const typeParam = searchParams.get("type");
  const type: ListType = isListType(typeParam) ? typeParam : "auto";
  const theme = INVOICE_STATUS_THEME[type];
  const meta = LIST_META[type];

  const { autoPostedInvoices, manualPostedInvoices, failedInvoices, loading, error } = useAppSelector(
    (state) => state.invoice,
  );
  const qbConnectionId = useAppSelector((state) => state.quickBooks.qbConnectionId);

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

  const invoices: InvoiceRecord[] = useMemo(() => {
    if (type === "auto") return autoPostedInvoices;
    if (type === "manual") return manualPostedInvoices;
    return failedInvoices;
  }, [type, autoPostedInvoices, manualPostedInvoices, failedInvoices]);

  const handleOpenInvoice = (invoice: InvoiceRecord) => {
    dispatch(setSelectedInvoice(invoice));
    router.push(`/invoices/${invoice._id}?type=${type}`);
  };

  const tabCounts: Record<ListType, number> = {
    auto: autoPostedInvoices.length,
    manual: manualPostedInvoices.length,
    failed: failedInvoices.length,
  };

  return (
    <div>
      <div className="mx-auto max-w-3xl p-[var(--space-lg)]">
        {/* Category tabs — this is the only in-page way to reach Manually
            Posted / Failed; the sidebar's "Invoices" link carries no query
            string and always lands here defaulted to Auto-Posted. Plain/
            uncolored by design — the three StatRow boxes below carry the
            per-status color instead of the tab bar itself. */}
        <div className="mb-[var(--space-md)] flex gap-[var(--space-xs)] rounded-md bg-background-alt p-[var(--space-xs)]">
          {TAB_ORDER.map((t) => {
            const active = t === type;
            return (
              <button
                key={t}
                type="button"
                onClick={() => router.replace(`/invoices?type=${t}`)}
                aria-current={active ? "page" : undefined}
                className={`flex-1 rounded-md px-[var(--space-sm)] py-[var(--space-xs)] text-body-sm font-semibold ${
                  active ? "bg-white text-trust-navy shadow-sm" : "text-text-secondary"
                }`}
              >
                {LIST_META[t].tabLabel} ({tabCounts[t]})
              </button>
            );
          })}
        </div>

        <div className="mb-[var(--space-lg)] flex flex-col gap-[var(--space-sm)] sm:flex-row">
          <StatRow count={tabCounts.auto} label="Auto-Posted" href="/invoices?type=auto" theme="auto" />
          <StatRow count={tabCounts.manual} label="Manually Posted" href="/invoices?type=manual" theme="manual" />
          <StatRow count={tabCounts.failed} label="Failed" href="/invoices?type=failed" theme="failed" />
        </div>

        {loading ? (
          <SkeletonListRows count={4} className="py-[var(--space-sm)]" />
        ) : error ? (
          <ErrorState message="Couldn't load these invoices." onRetry={refetch} />
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center py-[var(--space-xl)] text-center">
            <span className="mb-[var(--space-md)] flex h-24 w-24 items-center justify-center rounded-full" style={{ backgroundColor: `${theme.accentHex}22` }}>
              <FileX2 size={40} strokeWidth={1.5} style={{ color: theme.accentHex }} />
            </span>
            <p className="text-h3 font-extrabold" style={{ color: theme.accentHex }}>
              No invoices found
            </p>
            <p className="mt-[var(--space-xs)] max-w-sm text-body-sm text-text-secondary">{meta.emptyMessage}</p>
          </div>
        ) : (
          <>
            <div
              className="mb-[var(--space-md)] rounded-md px-[var(--space-md)] py-[var(--space-sm)] text-body-sm font-semibold"
              style={{ backgroundColor: `${theme.accentHex}18`, color: theme.accentHex }}
            >
              {invoices.length} {invoices.length === 1 ? "invoice" : "invoices"} &middot; {theme.label}
            </div>

            <div className="flex flex-col gap-[var(--space-sm)]">
              {invoices.map((invoice) => {
                const failureReason = getInvoiceFailureReason(invoice);
                const confidence =
                  invoice.confidenceScore != null ? `${Math.round(Number(invoice.confidenceScore))}%` : null;
                return (
                  <button
                    key={invoice._id}
                    type="button"
                    onClick={() => handleOpenInvoice(invoice)}
                    className="flex items-start gap-[var(--space-sm)] rounded-lg border-l-4 bg-white p-[var(--space-md)] text-left shadow-sm"
                    style={{ borderLeftColor: theme.accentHex }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-[var(--space-sm)]">
                        <p className="truncate font-bold text-text-primary">{getInvoiceTitle(invoice)}</p>
                        <p className="shrink-0 font-extrabold" style={{ color: theme.accentHex }}>
                          {getInvoiceAmount(invoice)}
                        </p>
                      </div>
                      <div className="mt-[var(--space-xs)] flex items-center gap-[var(--space-xs)]">
                        <span className={`rounded-pill px-[var(--space-sm)] py-[2px] text-caption font-bold ${theme.badgeClass}`}>
                          {theme.label}
                        </span>
                        {confidence && (
                          <span className={`rounded-pill px-[var(--space-sm)] py-[2px] text-caption font-semibold ${theme.badgeClass}`}>
                            {confidence} confidence
                          </span>
                        )}
                      </div>
                      <div className="mt-[var(--space-xs)] flex items-center justify-between gap-[var(--space-sm)]">
                        <span className="text-caption text-text-secondary">{getInvoicePostedDate(invoice)}</span>
                        {failureReason && (
                          <span className="truncate text-caption text-error">{failureReason}</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={18} strokeWidth={2} className="shrink-0 text-text-secondary" />
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
