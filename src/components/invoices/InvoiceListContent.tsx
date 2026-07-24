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

type ListType = "auto" | "manual" | "failed";

const LIST_META: Record<ListType, { title: string; emptyMessage: string }> = {
  auto: {
    title: "Auto-Posted Invoices",
    emptyMessage: "No auto-posted invoices yet. Invoices with high confidence will appear here.",
  },
  manual: {
    title: "Manually Posted Invoices",
    emptyMessage: "No manually posted invoices yet. Reviewed invoices will appear here.",
  },
  failed: {
    title: "Failed Invoices",
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

  const { autoPostedInvoices, manualPostedInvoices, failedInvoices, loading } = useAppSelector(
    (state) => state.invoice,
  );

  useEffect(() => {
    dispatch(getInvoices());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const invoices: InvoiceRecord[] = useMemo(() => {
    if (type === "auto") return autoPostedInvoices;
    if (type === "manual") return manualPostedInvoices;
    return failedInvoices;
  }, [type, autoPostedInvoices, manualPostedInvoices, failedInvoices]);

  const handleOpenInvoice = (invoice: InvoiceRecord) => {
    dispatch(setSelectedInvoice(invoice));
    router.push(`/invoices/${invoice._id}?type=${type}`);
  };

  return (
    <div>
      <div className="flex h-16 items-center gap-[var(--space-sm)] px-[var(--space-lg)]" style={{ backgroundColor: theme.accentHex }}>
        <h1 className="text-body font-extrabold text-white">{meta.title}</h1>
        <span className="rounded-pill bg-white/25 px-[var(--space-sm)] py-[2px] text-caption font-bold text-white">
          {invoices.length}
        </span>
      </div>

      <div className="mx-auto max-w-3xl p-[var(--space-lg)]">
        {loading ? (
          <p className="py-[var(--space-xl)] text-center text-body-sm text-text-secondary">Loading invoices…</p>
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
