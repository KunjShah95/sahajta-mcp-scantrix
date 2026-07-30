"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Info, RefreshCw } from "lucide-react";
import { useEffect } from "react";

import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { getInvoices } from "@/store/invoice/invoiceApi";
import { setSelectedInvoice } from "@/store/invoice/invoiceSlice";
import { clearCreatedVendor, clearSelectedVendor } from "@/store/vendor/vendorSlice";
import type { InvoiceRecord } from "@/store/invoice/invoiceSlice";
import { translateInvoiceReason } from "@/lib/invoiceDisplay";
import { ErrorState } from "@/components/ui/ErrorState";
import { SkeletonListRows } from "@/components/ui/Skeleton";

function getInvoiceTitle(invoice: InvoiceRecord): string {
  const vendor = invoice.extractedData?.vendorName;
  if (vendor) return vendor;
  return invoice.file?.originalName?.replace(/\.pdf$/i, "").replace(/%20/g, " ") || "Unknown Vendor";
}

function getInvoiceNumber(invoice: InvoiceRecord): string | null {
  const num = invoice.extractedData?.invoiceNumber;
  return num ? `#${num}` : null;
}

function getInvoiceAmount(invoice: InvoiceRecord): string | null {
  const amount = invoice.extractedData?.totalAmount;
  const currency = invoice.extractedData?.currency || "";
  if (!amount) return null;
  return `${currency} ${amount}`;
}

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

export function PendingInvoicesContent() {
  const dispatch = useAppDispatch();
  const router = useRouter();

  const { pendingInvoices, loading, error } = useAppSelector((state) => state.invoice);
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

  const handleOpenInvoice = (invoice: InvoiceRecord) => {
    dispatch(clearSelectedVendor());
    dispatch(clearCreatedVendor());
    dispatch(setSelectedInvoice(invoice));
    router.push(`/invoices/${invoice._id}/review`);
  };

  const total = pendingInvoices.length;

  return (
    <div>
      <div className="flex items-center gap-[var(--space-md)] bg-primary px-[var(--space-lg)] py-[var(--space-md)]">
        <div className="flex-1">
          <h1 className="text-h3 font-extrabold text-white">Pending Reviews</h1>
          <p className="mt-[2px] text-body-sm text-white/80">
            {total} invoice{total !== 1 ? "s" : ""} need attention
          </p>
        </div>
        <button
          type="button"
          onClick={refetch}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white"
          aria-label="Refresh"
        >
          <RefreshCw size={18} strokeWidth={2} />
        </button>
      </div>

      <div className="mx-auto max-w-2xl p-[var(--space-lg)]">
        {loading ? (
          <SkeletonListRows count={4} className="py-[var(--space-sm)]" />
        ) : error ? (
          <ErrorState message="Couldn't load pending invoices." onRetry={refetch} />
        ) : pendingInvoices.length === 0 ? (
          <div className="mt-[var(--space-xl)] flex flex-col items-center px-[var(--space-lg)] text-center">
            <span className="mb-[var(--space-md)] flex h-18 w-18 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 size={32} strokeWidth={1.75} className="text-primary" />
            </span>
            <p className="text-h3 font-extrabold text-text-primary">All caught up</p>
            <p className="mt-[var(--space-sm)] text-body-sm text-text-secondary">
              No pending invoices right now. New ones will appear here automatically.
            </p>
            <button
              type="button"
              onClick={refetch}
              className="mt-[var(--space-lg)] flex items-center gap-[var(--space-xs)] rounded-md border-2 border-primary px-[var(--space-lg)] py-[var(--space-sm)] font-bold text-primary"
            >
              <RefreshCw size={16} strokeWidth={2.25} />
              Refresh
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-[var(--space-sm)]">
            {pendingInvoices.map((invoice) => {
              const invoiceNumber = getInvoiceNumber(invoice);
              const amount = getInvoiceAmount(invoice);
              const issue = getPrimaryIssue(invoice);
              return (
                <button
                  key={invoice._id}
                  type="button"
                  onClick={() => handleOpenInvoice(invoice)}
                  className="overflow-hidden rounded-lg border border-border bg-white text-left shadow-sm"
                >
                  <div className="p-[var(--space-md)]">
                    <div className="flex items-center justify-between gap-[var(--space-sm)]">
                      <p className="truncate font-bold text-text-primary">{getInvoiceTitle(invoice)}</p>
                      <span className="shrink-0 rounded-md bg-[#EEF6FF] px-[var(--space-sm)] py-[2px] text-caption font-bold text-[#3B82F6]">
                        PENDING
                      </span>
                    </div>
                    <div className="mt-[var(--space-xs)] flex items-center gap-[var(--space-xs)] text-body-sm font-semibold text-text-secondary">
                      {invoiceNumber && <span>{invoiceNumber}</span>}
                      {invoiceNumber && amount && <span className="text-border">&middot;</span>}
                      {amount ? <span>{amount}</span> : <span className="italic text-text-secondary/70">Amount not extracted</span>}
                    </div>
                    {issue && (
                      <div className="mt-[var(--space-sm)] flex items-start gap-[var(--space-xs)] rounded-md border border-[#FDE68A] bg-[#FFFBEB] px-[var(--space-sm)] py-[var(--space-xs)]">
                        <Info size={14} strokeWidth={2.25} className="mt-0.5 shrink-0 text-[#B45309]" />
                        <span className="text-caption font-semibold text-[#92400E]">{issue}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between border-t border-[#F3F3F3] bg-[#FAFAFA] px-[var(--space-md)] py-[var(--space-sm)]">
                    <span className="text-body-sm font-bold text-primary">Review Invoice</span>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <ArrowRight size={16} strokeWidth={2.25} />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
