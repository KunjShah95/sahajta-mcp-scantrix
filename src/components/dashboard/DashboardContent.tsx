"use client";

import Link from "next/link";
import { ArrowRight, Clock, Upload } from "lucide-react";
import { ChangeEvent, DragEvent, useCallback, useEffect, useRef, useState } from "react";

import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { SkeletonListRows } from "@/components/ui/Skeleton";
import { Spinner } from "@/components/ui/Spinner";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { getInvoices } from "@/store/invoice/invoiceApi";
import { connectQuickBooks, getMyQBConnections } from "@/store/quickBooks/quickBooksApi";
import { scanInvoice } from "@/store/invoice/invoiceApi";
import { showToast } from "@/lib/dialogManager";
import { capitalizeWords } from "@/lib/textFormat";
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

// Vertical scoreboard row — replaces the old side-by-side SummaryCard grid
// now that the stat column sits narrower, next to the dropzone. Same theme
// classes and same live counts, just laid out horizontally per row instead
// of stacked vertically per card.
function StatRow({
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
      className={`flex flex-1 items-center justify-between gap-[var(--space-sm)] rounded-lg p-[var(--space-md)] ${INVOICE_STATUS_THEME[theme].cardBgClass}`}
    >
      <span className={`text-body-sm font-semibold ${colorClass}`}>{label}</span>
      <span className={`text-h1 font-bold ${colorClass}`}>{count}</span>
    </Link>
  );
}

// Real dropzone matching the landing page's ScanVisual card style (dashed
// border, centered icon-in-circle, generous padding) — visual language
// only, none of that component's fake demo content. Both drag-and-drop and
// click-to-browse funnel into the same `onFileSelected`, which the parent
// wires to the exact scanInvoice upload path the old small button used —
// no parallel upload logic.
function InvoiceDropzone({
  uploading,
  onFileSelected,
}: {
  uploading: boolean;
  onFileSelected: (file: File) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const dragDepth = useRef(0);

  const openPicker = () => {
    if (!uploading) fileInputRef.current?.click();
  };

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepth.current += 1;
    setDragActive(true);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    // Required so the browser treats this element as a valid drop target.
    event.preventDefault();
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragActive(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepth.current = 0;
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) onFileSelected(file);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) onFileSelected(file);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload invoice — drag and drop or click to browse"
      onClick={openPicker}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openPicker();
        }
      }}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex min-h-[280px] flex-1 cursor-pointer flex-col items-center justify-center gap-[var(--space-sm)] rounded-xl border-2 border-dashed p-[var(--space-xl)] text-center transition-colors ${
        dragActive ? "border-primary bg-primary/10" : "border-primary/40 bg-background-soft hover:bg-primary/5"
      } ${uploading ? "pointer-events-none opacity-70" : ""}`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        disabled={uploading}
        onChange={handleChange}
      />
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm">
        {uploading ? <Spinner size="md" /> : <Upload size={26} strokeWidth={2} className="text-primary" />}
      </span>
      <p className="text-body font-bold text-trust-navy">
        {uploading ? "Uploading…" : "Drag & drop your invoice"}
      </p>
      <p className="text-body-sm text-text-secondary">
        {uploading ? "This won't take long." : "or click to browse — PDF or photo"}
      </p>
    </div>
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

  const name = capitalizeWords(user?.data?.user?.firstName || user?.data?.user?.email?.split("@")[0] || "there");
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
    let cancelled = false;
    (async () => {
      // getInvoices() is scoped by whatever qbConnectionId is currently in
      // the store (via the X-QB-Id header — see lib/api.ts's interceptor),
      // and the backend 400s outright if that header is missing. Right
      // after a fresh login that id is deliberately blank (the login-time
      // purge resets it so a previous session's value can't leak in), so
      // firing this before getMyQBConnections has had a chance to populate
      // the real one made every first load fail until a manual retry.
      if (accessToken) {
        await dispatch(getMyQBConnections({ accessToken }));
      }
      if (!cancelled) syncInvoices();
    })();
    return () => {
      cancelled = true;
    };
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

  // Single upload path for every entry point (click-to-browse, drag-and-drop) —
  // both call this, neither duplicates it. Keeps the FormData/scanInvoice call
  // exactly as it was before the dropzone existed (see scanInvoice's own
  // comment on the RN-FormData bug this fixed once already).
  const uploadFile = useCallback(
    async (file: File) => {
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
    },
    [dispatch, qbConnectionId, syncInvoices],
  );

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-[var(--space-md)] p-[var(--space-lg)]">
      <h1 className="text-h3 font-bold text-trust-navy">{greetingFor(name)}</h1>

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

      {/*
        Upload gets the wider, first-read column — it's the primary action on
        this page. The three totals move into a narrower scoreboard beside it,
        restacked vertically since they no longer need full card width to be
        legible as a single number + label each.
      */}
      <div className="flex flex-col gap-[var(--space-md)] md:flex-row">
        <InvoiceDropzone uploading={uploading} onFileSelected={uploadFile} />
        <div className="flex flex-col gap-[var(--space-sm)] md:w-64">
          <StatRow count={autoPostedInvoices.length} label="Auto-posted" href="/invoices?type=auto" theme="auto" />
          <StatRow
            count={manualPostedInvoices.length}
            label="Manually Posted"
            href="/invoices?type=manual"
            theme="manual"
          />
          <StatRow count={failedInvoices.length} label="Failed" href="/invoices?type=failed" theme="failed" />
        </div>
      </div>

      <div className="mt-[var(--space-md)] flex items-center justify-between">
        <h2 className="text-h3 font-bold text-text-primary">Recent</h2>
        {invoiceLoading && recentInvoices.length > 0 && <Spinner size="sm" />}
      </div>

      {invoiceLoading && recentInvoices.length === 0 && <SkeletonListRows count={3} />}

      {/* Show the error whenever the fetch failed, regardless of whether
          recentInvoices happens to be non-empty — a failed fetch means
          whatever's in state is not this session's confirmed data, and
          masking that behind stale data is exactly how the cross-account
          invoice leak went unnoticed. Don't render the (possibly stale)
          list alongside it. */}
      {!invoiceLoading && invoiceError && (
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

      {!invoiceError &&
        recentInvoices.map((invoice) => (
          <InvoiceRow key={invoice._id} invoice={invoice} />
        ))}
    </div>
  );
}
