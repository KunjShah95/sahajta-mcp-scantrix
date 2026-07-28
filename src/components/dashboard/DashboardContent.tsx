"use client";

import Link from "next/link";
import { ArrowRight, Clock, Upload } from "lucide-react";
import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";

import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { SkeletonListRows } from "@/components/ui/Skeleton";
import { Spinner } from "@/components/ui/Spinner";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { getInvoices } from "@/store/invoice/invoiceApi";
import { connectQuickBooks, getMyQBConnections } from "@/store/quickBooks/quickBooksApi";
import { scanInvoice } from "@/store/invoice/invoiceApi";
import { showToast } from "@/lib/dialogManager";
import {
  INVOICE_STATUS_THEME,
  getInvoiceAmount,
  getInvoiceFailureReason,
  getInvoiceStatus,
  getInvoiceTitle,
} from "@/lib/invoiceDisplay";
import type { InvoiceRecord } from "@/store/invoice/invoiceSlice";

function greetingFor(name: string): string {
  const hour = new Date().getHours();
  if (hour < 12) return `Good morning, ${name}`;
  if (hour < 18) return `Good afternoon, ${name}`;
  return `Good evening, ${name}`;
}

function SummaryCard({
  count,
  label,
  href,
  theme,
}: {
  count: number;
  label: string;
  href: string;
  theme: "auto" | "manual" | "failed";
}) {
  const colorClass =
    theme === "auto" ? "text-success" : theme === "manual" ? "text-warning" : "text-error";
  return (
    <Link
      href={href}
      className={`flex min-h-[120px] flex-1 flex-col items-center justify-between rounded-lg p-[var(--space-md)] ${INVOICE_STATUS_THEME[theme].cardBgClass}`}
    >
      <span className={`text-h1 font-bold ${colorClass}`}>{count}</span>
      <span className={`mt-[var(--space-xs)] text-center text-caption font-semibold ${colorClass}`}>
        {label}
      </span>
    </Link>
  );
}

function InvoiceRow({ invoice }: { invoice: InvoiceRecord }) {
  const status = getInvoiceStatus(invoice.postedStatus);
  const theme = INVOICE_STATUS_THEME[status];
  const reason = getInvoiceFailureReason(invoice);

  if (status === "processing") {
    return (
      <div className={`mb-[var(--space-sm)] rounded-lg p-[var(--space-md)] ${theme.cardBgClass}`}>
        <div className="flex items-center justify-between gap-[var(--space-sm)]">
          <span className="flex-1 truncate font-bold text-text-primary">
            {invoice.file?.originalName || "Invoice"}
          </span>
          <span className="text-body-sm font-bold text-warning">Processing</span>
        </div>
        <div className="mt-[var(--space-sm)] flex items-center gap-[var(--space-xs)]">
          <span
            aria-hidden
            className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary"
          />
          <span className="text-body-sm text-text-secondary">Invoice is being processed…</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`mb-[var(--space-sm)] rounded-lg p-[var(--space-md)] ${theme.cardBgClass}`}>
      <div className="flex items-center justify-between gap-[var(--space-sm)]">
        <span className="flex-1 truncate font-bold text-text-primary">{getInvoiceTitle(invoice)}</span>
        <span className={`text-body-sm font-bold uppercase ${theme.badgeClass.split(" ")[1]}`}>
          {theme.label}
        </span>
      </div>
      <div className="mt-[var(--space-sm)] flex items-center gap-[var(--space-xs)]">
        <span className="h-2.5 w-2.5 rounded-sm bg-text-secondary" />
        <span className="text-body-sm text-text-secondary">{getInvoiceAmount(invoice)}</span>
      </div>
      {reason && <p className="mt-[var(--space-xs)] text-caption font-semibold text-error">{reason}</p>}
    </div>
  );
}

export function DashboardContent() {
  const dispatch = useAppDispatch();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [connectingQB, setConnectingQB] = useState(false);

  const user = useAppSelector((state) => state.auth.user);
  const {
    invoices,
    autoPostedInvoices,
    manualPostedInvoices,
    pendingInvoices,
    failedInvoices,
    loading: invoiceLoading,
    error: invoiceError,
  } = useAppSelector((state) => state.invoice);
  const { connected, statusLoading, qbConnectionId } = useAppSelector((state) => state.quickBooks);

  const name = user?.data?.user?.firstName || user?.data?.user?.email?.split("@")[0] || "there";
  const accessToken: string | undefined = user?.data?.accessToken;

  const syncInvoices = useCallback(() => {
    dispatch(getInvoices());
  }, [dispatch]);

  const handleConnectQuickBooks = async () => {
    if (!accessToken || connectingQB) return;
    setConnectingQB(true);
    try {
      const result = await dispatch(connectQuickBooks({ accessToken }));
      if (connectQuickBooks.fulfilled.match(result)) {
        const authUrl = result.payload?.data?.authUrl;
        if (authUrl) {
          window.location.href = authUrl;
          return;
        }
        showToast("Could not start QuickBooks connection. Please try again.", "error");
      } else {
        showToast(typeof result.payload === "string" ? result.payload : "Could not start QuickBooks connection.", "error");
      }
    } finally {
      setConnectingQB(false);
    }
  };

  useEffect(() => {
    syncInvoices();
    if (accessToken) {
      dispatch(getMyQBConnections({ accessToken }));
    }
    // Only ever needs to run once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mirrors DashboardScreen's 3s poll while any invoice is still processing.
  useEffect(() => {
    const hasProcessing = invoices.some((invoice) => invoice.postedStatus === "processing");
    if (!hasProcessing) return;
    const interval = setInterval(syncInvoices, 3000);
    return () => clearInterval(interval);
  }, [invoices, syncInvoices]);

  const pendingText =
    pendingInvoices.length === 1 ? "1 invoice needs your review" : `${pendingInvoices.length} invoices need your review`;

  const recentInvoices = invoices.slice(0, 5);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!qbConnectionId) {
      showToast("Please connect a QuickBooks account before scanning invoices.", "error");
      return;
    }

    setUploading(true);
    try {
      const result = await dispatch(scanInvoice({ file, qbId: qbConnectionId }));
      if (scanInvoice.fulfilled.match(result)) {
        setTimeout(syncInvoices, 1500);
      } else {
        const payload = result.payload;
        showToast(typeof payload === "string" ? payload : "Invoice scan failed", "error");
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-[var(--space-md)] p-[var(--space-lg)]">
      <div className="flex items-center justify-between gap-[var(--space-md)]">
        <h1 className="text-h3 font-bold text-trust-navy">{greetingFor(name)}</h1>

        <label className="inline-flex cursor-pointer items-center gap-[var(--space-xs)] rounded-md bg-primary px-[var(--space-md)] py-[var(--space-sm)] text-body-sm font-semibold text-white hover:opacity-90">
          <Upload size={16} strokeWidth={2.25} />
          {uploading ? "Uploading…" : "Upload invoice"}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            disabled={uploading}
            onChange={handleFileChange}
          />
        </label>
      </div>

      {!statusLoading && !connected && (
        <button
          type="button"
          onClick={handleConnectQuickBooks}
          disabled={connectingQB}
          className="flex items-center justify-between rounded-lg border border-[#F5D7A4] bg-[#FFF7E6] p-[var(--space-md)] text-left disabled:opacity-60"
        >
          <div>
            <p className="font-bold text-[#9A6700]">QuickBooks Not Connected</p>
            <p className="mt-[var(--space-xs)] text-caption text-text-secondary">
              {connectingQB ? "Connecting…" : "Connect QuickBooks to sync vendors and post invoices."}
            </p>
          </div>
          <ArrowRight size={20} strokeWidth={2} className="shrink-0 text-primary" />
        </button>
      )}

      <Link
        href="/invoices/pending"
        className="flex items-center justify-between rounded-lg border border-[#CBEDE7] bg-background-soft p-[var(--space-md)]"
      >
        <div className="flex items-center gap-[var(--space-sm)]">
          <span className="flex h-12 w-12 items-center justify-center rounded-md bg-primary text-white">
            <Clock size={22} strokeWidth={2} />
          </span>
          <div>
            <p className="font-bold text-trust-navy">Pending Review</p>
            <p className="mt-[var(--space-xs)] text-body-sm font-medium text-text-secondary">{pendingText}</p>
          </div>
        </div>
        <div className="flex items-center gap-[var(--space-xs)]">
          <span className="flex h-7 min-w-7 items-center justify-center rounded-pill bg-primary px-[var(--space-xs)] text-body-sm font-bold text-white">
            {pendingInvoices.length}
          </span>
          <ArrowRight size={18} strokeWidth={2} className="shrink-0 text-primary" />
        </div>
      </Link>

      <div className="flex gap-[var(--space-sm)]">
        <SummaryCard count={autoPostedInvoices.length} label="Auto-posted" href="/invoices?type=auto" theme="auto" />
        <SummaryCard
          count={manualPostedInvoices.length}
          label="Manually Posted"
          href="/invoices?type=manual"
          theme="manual"
        />
        <SummaryCard count={failedInvoices.length} label="Failed" href="/invoices?type=failed" theme="failed" />
      </div>

      <div className="mt-[var(--space-md)] flex items-center justify-between">
        <h2 className="text-h3 font-bold text-text-primary">Recent</h2>
        {invoiceLoading && recentInvoices.length > 0 && <Spinner size="sm" />}
      </div>

      {invoiceLoading && recentInvoices.length === 0 && <SkeletonListRows count={3} />}

      {!invoiceLoading && invoiceError && recentInvoices.length === 0 && (
        <ErrorState message="Couldn't load recent invoices." onRetry={syncInvoices} />
      )}

      {!invoiceLoading && !invoiceError && recentInvoices.length === 0 && (
        <Card className="flex flex-col items-center py-[var(--space-lg)] text-center">
          <p className="font-bold text-text-primary">No invoices yet</p>
          <p className="mt-[var(--space-xs)] text-body-sm text-text-secondary">
            Scanned and posted invoices will appear here.
          </p>
        </Card>
      )}

      {recentInvoices.map((invoice) => (
        <InvoiceRow key={invoice._id} invoice={invoice} />
      ))}
    </div>
  );
}
