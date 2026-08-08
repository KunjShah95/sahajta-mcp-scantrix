"use client";

import { useRouter } from "next/navigation";
import { ChevronRight, FileX2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { getInvoices } from "@/store/invoice/invoiceApi";
import { setSelectedInvoice } from "@/store/invoice/invoiceSlice";
import { clearCreatedVendor, clearSelectedVendor } from "@/store/vendor/vendorSlice";
import type { InvoiceRecord } from "@/store/invoice/invoiceSlice";
import {
  INVOICE_STATUS_THEME,
  getInvoiceAmount,
  getInvoicePostedDate,
  getInvoiceTitle,
  translateInvoiceReason,
} from "@/lib/invoiceDisplay";
import { ErrorState } from "@/components/ui/ErrorState";
import { SkeletonListRows } from "@/components/ui/Skeleton";
import { SelectedInvoiceCard, vendorInitials } from "@/components/invoices/SelectedInvoiceCard";

const PENDING_THEME = INVOICE_STATUS_THEME.pending;

// Show only the single most important issue — reason first, then missing fields.
function getPrimaryIssue(invoice: InvoiceRecord): string | null {
  const history = invoice.statusHistory;
  if (history && history.length > 0) {
    const reason = translateInvoiceReason(history[history.length - 1]?.reason);
    if (reason) return reason.message;
  }
  const missing = invoice.confidenceBreakdown?.missingFields;
  if (missing && missing.length > 0) return `Missing: ${missing.join(", ")}`;
  return null;
}

// Same table + selected-invoice-panel format as InvoiceListContent, scoped to
// pendingInvoices only and stripped of what doesn't apply here: no stat
// tiles (this list is a single status, a dollar total wouldn't mean much),
// no search/sort/status/vendor/currency filter bar, and no
// OutcomeMixCard/TopVendorsCard default sidebar — just the list and, once a
// row is selected, its detail panel.
export function PendingInvoicesContent() {
  const dispatch = useAppDispatch();
  const router = useRouter();

  const { pendingInvoices, loading, error } = useAppSelector((state) => state.invoice);
  const qbConnectionId = useAppSelector((state) => state.quickBooks.qbConnectionId);
  const glAccounts = useAppSelector((state) => state.quickBooks.accounts);
  const taxCodes = useAppSelector((state) => state.quickBooks.taxCodes);

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

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

  // Pending invoices always go to the editable review screen, never the
  // read-only detail page — matches handleOpenInvoice's own special-case for
  // "pending" elsewhere, except here it's the only case since this list is
  // pending-only.
  const handleOpenFullDetails = (invoice: InvoiceRecord) => {
    dispatch(clearSelectedVendor());
    dispatch(clearCreatedVendor());
    dispatch(setSelectedInvoice(invoice));
    router.push(`/invoices/${invoice._id}/review`);
  };

  const selectedInvoice = selectedInvoiceId
    ? pendingInvoices.find((invoice) => invoice._id === selectedInvoiceId) || null
    : null;

  const total = pendingInvoices.length;

  return (
    <div>
      <div className="mx-auto max-w-6xl p-[var(--space-lg)]">
        {/* Ported from VendorsContent's page heading — plain h1 + subtitle +
            right-aligned action button, instead of this screen's previous
            full-bleed colored banner. */}
        <div className="flex items-center justify-between gap-[var(--space-md)]">
          <div className="min-w-0">
            <h1 className="text-h2 font-bold text-trust-navy">Pending Reviews</h1>
            <p className="mt-[var(--space-xs)] text-body-sm text-text-secondary">
              {total} invoice{total !== 1 ? "s" : ""} need attention
            </p>
          </div>
          <button
            type="button"
            onClick={refetch}
            aria-label="Refresh"
            title="Refresh"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-border bg-white text-trust-navy transition-opacity hover:bg-background-alt"
          >
            <RefreshCw size={18} strokeWidth={2.25} />
          </button>
        </div>

        <div className="mt-[var(--space-lg)] grid gap-[var(--space-lg)] lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
          <div className="rounded-lg border border-border bg-white">
            {!loading && !error && pendingInvoices.length > 0 && (
              <div className="hidden gap-[var(--space-sm)] px-[var(--space-md)] pb-[var(--space-sm)] pt-[var(--space-md)] text-caption font-bold uppercase tracking-wide text-text-secondary lg:grid lg:grid-cols-[40px_2fr_1fr_1fr_1fr_24px]">
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
                <ErrorState message="Couldn't load pending invoices." onRetry={refetch} />
              </div>
            ) : pendingInvoices.length === 0 ? (
              <div className="flex flex-col items-center py-[var(--space-xl)] text-center">
                <span className="mb-[var(--space-md)] flex h-24 w-24 items-center justify-center rounded-full bg-background-alt">
                  <FileX2 size={40} strokeWidth={1.5} className="text-text-secondary" />
                </span>
                <p className="text-h3 font-extrabold text-text-primary">All caught up</p>
                <p className="mt-[var(--space-xs)] max-w-sm text-body-sm text-text-secondary">
                  No pending invoices right now. New ones will appear here automatically.
                </p>
              </div>
            ) : (
              <div>
                {pendingInvoices.map((invoice) => {
                  const issue = getPrimaryIssue(invoice);
                  const confidence =
                    invoice.confidenceScore != null ? `${Math.round(Number(invoice.confidenceScore))}%` : null;
                  const isSelected = invoice._id === selectedInvoiceId;
                  return (
                    <button
                      key={invoice._id}
                      type="button"
                      onClick={() => setSelectedInvoiceId(invoice._id)}
                      className={`flex w-full items-start gap-[var(--space-sm)] border-b border-border px-[var(--space-md)] py-[var(--space-sm)] text-left last:border-b-0 lg:grid lg:grid-cols-[40px_2fr_1fr_1fr_1fr_24px] lg:items-center ${
                        isSelected ? "bg-primary-50" : "hover:bg-background-alt"
                      }`}
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-caption font-bold ${PENDING_THEME.cardBgClass} ${PENDING_THEME.accentTextClass}`}
                      >
                        {vendorInitials(invoice)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-text-primary">
                          {getInvoiceTitle(invoice)}
                        </span>
                        {issue ? (
                          <span className="block truncate text-caption text-error">{issue}</span>
                        ) : confidence ? (
                          <span className="block truncate text-caption text-text-secondary">
                            {confidence} confidence
                          </span>
                        ) : null}
                        <span className="mt-[var(--space-xs)] flex flex-wrap items-center gap-x-[var(--space-sm)] gap-y-[2px] lg:hidden">
                          <span
                            className={`inline-flex w-fit items-center rounded-pill px-[var(--space-sm)] py-[2px] text-caption font-bold ${PENDING_THEME.badgeClass}`}
                          >
                            {PENDING_THEME.label}
                          </span>
                          <span className="text-caption text-text-secondary">{getInvoicePostedDate(invoice)}</span>
                          <span className="ml-auto font-bold text-text-primary">{getInvoiceAmount(invoice)}</span>
                        </span>
                      </span>
                      <span className="hidden text-body-sm text-text-secondary lg:block">
                        {getInvoicePostedDate(invoice)}
                      </span>
                      <span className="hidden lg:block">
                        <span
                          className={`inline-flex w-fit items-center rounded-pill px-[var(--space-sm)] py-[2px] text-caption font-bold ${PENDING_THEME.badgeClass}`}
                        >
                          {PENDING_THEME.label}
                        </span>
                      </span>
                      <span className="hidden text-right font-bold text-text-primary lg:block">
                        {getInvoiceAmount(invoice)}
                      </span>
                      <ChevronRight
                        size={18}
                        strokeWidth={2}
                        className="mt-[2px] shrink-0 justify-self-end text-text-secondary lg:mt-0"
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <aside className="flex flex-col gap-[var(--space-md)]">
            {selectedInvoice ? (
              <SelectedInvoiceCard
                invoice={selectedInvoice}
                theme={PENDING_THEME}
                glAccounts={glAccounts}
                taxCodes={taxCodes}
                issueMessage={getPrimaryIssue(selectedInvoice) ?? undefined}
                onViewFullDetails={() => handleOpenFullDetails(selectedInvoice)}
                onClose={() => setSelectedInvoiceId(null)}
              />
            ) : (
              <div className="hidden items-center justify-center rounded-lg border border-dashed border-border p-[var(--space-lg)] text-center text-body-sm text-text-secondary lg:flex">
                Select an invoice to preview its details.
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
