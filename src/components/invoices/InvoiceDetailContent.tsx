"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ChevronLeft } from "lucide-react";
import { useEffect, useMemo } from "react";

import { BrandIcon } from "@/components/icons/BrandIcon";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { getInvoiceDetails } from "@/store/invoice/invoiceApi";
import { fetchQuickBooksAccounts } from "@/store/quickBooks/quickBooksApi";
import { Spinner } from "@/components/ui/Spinner";
import {
  INVOICE_DETAIL_THEME,
  formatDetailAmount,
  formatDetailDate,
  getDetailInvoiceUrl,
  isInvoiceDetailType,
  safeDetailValue,
} from "@/lib/invoiceDetailTheme";

function SectionHeader({ title, bg, color }: { title: string; bg: string; color: string }) {
  return (
    <div className="px-[var(--space-md)] py-[var(--space-sm)] text-caption font-bold uppercase tracking-wide" style={{ backgroundColor: bg, color }}>
      {title}
    </div>
  );
}

function DetailRow({
  label,
  value,
  labelColor,
  dividerColor,
  isLast,
  highlight,
  highlightColor,
}: {
  label: string;
  value: string;
  labelColor: string;
  dividerColor: string;
  isLast?: boolean;
  highlight?: boolean;
  highlightColor?: string;
}) {
  return (
    <div
      className="flex items-center justify-between gap-[var(--space-md)] px-[var(--space-md)] py-[var(--space-sm)]"
      style={!isLast ? { borderBottom: `1px solid ${dividerColor}` } : undefined}
    >
      <span className="text-body-sm font-medium" style={{ color: labelColor }}>
        {label}
      </span>
      <span
        className={`text-right ${highlight ? "text-h3 font-black" : "text-body-sm font-bold text-text-primary"}`}
        style={highlight ? { color: highlightColor } : undefined}
      >
        {value}
      </span>
    </div>
  );
}

export function InvoiceDetailContent({ invoiceId }: { invoiceId: string }) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();

  const typeParam = searchParams.get("type");
  const type = isInvoiceDetailType(typeParam) ? typeParam : "auto";
  const theme = INVOICE_DETAIL_THEME[type];

  const invoiceObject = useAppSelector((state) => state.invoice.selectedInvoice);
  const accessToken = useAppSelector((state) => state.auth.user?.data?.accessToken);
  const glAccounts = useAppSelector((state) => state.quickBooks.accounts);

  useEffect(() => {
    dispatch(getInvoiceDetails(invoiceId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  useEffect(() => {
    if (accessToken) dispatch(fetchQuickBooksAccounts({ accessToken }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const rawData = invoiceObject?.extractedData;
  const statusHistory = invoiceObject?.statusHistory ?? [];
  const lineItems = rawData?.lineItems ?? [];

  const confidenceScore = Number.isFinite(Number(invoiceObject?.confidenceScore))
    ? Math.max(0, Math.min(100, Number(invoiceObject?.confidenceScore)))
    : null;

  const invoiceUrl = invoiceObject ? getDetailInvoiceUrl(invoiceObject) : undefined;
  const previewMimeType = invoiceObject?.file?.mimeType ?? "";
  const driveFileUrl = invoiceObject?.googleDrive?.fileUrl;

  const resolvedGlAccount = useMemo(
    () => glAccounts.find((acc) => acc.qbAccountId === String(rawData?.glAccountId ?? "")),
    [glAccounts, rawData?.glAccountId],
  );

  if (!invoiceObject) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background-soft">
        <Spinner size="md" />
      </div>
    );
  }

  const vendorName = safeDetailValue(rawData?.vendorName);
  const invoiceNumber = safeDetailValue(rawData?.invoiceNumber);
  const invoiceDate = safeDetailValue(rawData?.invoiceDate);
  const dueDate = safeDetailValue(rawData?.dueDate);
  const currency = safeDetailValue(rawData?.currency);
  const currencyForAmount = currency === "—" ? "" : currency;
  const amountBeforeTax = formatDetailAmount(rawData?.amountBeforeTax, currencyForAmount);
  const taxAmount = formatDetailAmount(rawData?.taxAmount, currencyForAmount);
  const totalAfterTax = formatDetailAmount(rawData?.totalAmount, currencyForAmount);
  const vendorAddress = safeDetailValue(rawData?.vendorAddress);
  const vendorBankDetails = safeDetailValue(rawData?.bankingDetails);
  const glCode = safeDetailValue(resolvedGlAccount?.name);
  const itemDescriptions = safeDetailValue(rawData?.description);
  const latestStatus = statusHistory.length > 0 ? statusHistory[statusHistory.length - 1] : null;

  const previewHref = invoiceUrl
    ? `/invoices/preview?url=${encodeURIComponent(invoiceUrl)}&mimeType=${encodeURIComponent(previewMimeType)}`
    : null;

  return (
    <div className="min-h-screen" style={{ backgroundColor: theme.screenBg }}>
      <div className="flex h-[58px] items-center justify-between px-[var(--space-md)]" style={{ backgroundColor: theme.headerBg }}>
        <button type="button" onClick={() => router.back()} aria-label="Back" className="text-white">
          <ChevronLeft size={26} strokeWidth={2.25} />
        </button>
        <h1 className="text-body font-extrabold text-white">Invoice Details</h1>
        {previewHref ? (
          <Link href={previewHref} className="rounded-md bg-white/20 px-[var(--space-sm)] py-[var(--space-xs)] text-body-sm font-bold text-white">
            View
          </Link>
        ) : (
          <span className="w-8" />
        )}
      </div>

      <div className="mx-auto flex max-w-2xl flex-col gap-[var(--space-md)] p-[var(--space-md)]">
        {/* Hero */}
        <div className="rounded-2xl px-[var(--space-lg)] pb-[var(--space-lg)] pt-[var(--space-md)]" style={{ backgroundColor: theme.cardBg }}>
          <div className="mb-[var(--space-xs)] flex items-center gap-[var(--space-sm)]">
            <span className="rounded-pill bg-white/70 px-[var(--space-sm)] py-1 text-caption font-bold" style={{ color: theme.accentColor }}>
              {theme.statusLabel}
            </span>
            {confidenceScore !== null && (
              <span className="rounded-pill bg-white/70 px-[var(--space-sm)] py-1 text-caption font-semibold" style={{ color: theme.accentColor }}>
                {Math.round(confidenceScore)}% confidence
              </span>
            )}
          </div>

          <p className="text-h2 font-extrabold" style={{ color: theme.labelColor }}>
            {vendorName}
          </p>
          {invoiceNumber !== "—" && (
            <p className="font-semibold" style={{ color: theme.valueColor }}>
              Invoice #{invoiceNumber}
            </p>
          )}

          <p className="mt-[var(--space-xs)] text-4xl font-black tracking-tight" style={{ color: theme.labelColor }}>
            {totalAfterTax}
          </p>

          {confidenceScore !== null && (
            <div className="mt-[var(--space-md)] h-1.5 overflow-hidden rounded-md bg-white/50">
              <div
                className="h-full rounded-md"
                style={{ width: `${Math.max(6, confidenceScore)}%`, backgroundColor: theme.accentColor }}
              />
            </div>
          )}

          {type === "failed" && latestStatus?.reason && (
            <div className="mt-[var(--space-sm)] flex items-start gap-[var(--space-xs)] rounded-md bg-white/70 p-[var(--space-sm)]">
              <AlertTriangle size={16} strokeWidth={2} className="mt-0.5 shrink-0 text-error" />
              <p className="text-body-sm font-medium text-error">{latestStatus.reason}</p>
            </div>
          )}
        </div>

        {/* Invoice Information */}
        <div className="overflow-hidden rounded-lg bg-white shadow-sm">
          <SectionHeader title="Invoice Information" bg={theme.sectionHeaderBg} color={theme.accentColor} />
          <DetailRow label="Invoice Number" value={invoiceNumber} labelColor={theme.labelColor} dividerColor={theme.divider} />
          <DetailRow label="Invoice Date" value={invoiceDate} labelColor={theme.labelColor} dividerColor={theme.divider} />
          <DetailRow label="Due Date" value={dueDate} labelColor={theme.labelColor} dividerColor={theme.divider} />
          <DetailRow label="Currency" value={currency} labelColor={theme.labelColor} dividerColor={theme.divider} />
          <DetailRow label="GL Code / Category" value={glCode} labelColor={theme.labelColor} dividerColor={theme.divider} isLast />
        </div>

        {/* Financial Summary */}
        <div className="overflow-hidden rounded-lg bg-white shadow-sm">
          <SectionHeader title="Financial Summary" bg={theme.sectionHeaderBg} color={theme.accentColor} />
          <DetailRow label="Amount Before Tax" value={amountBeforeTax} labelColor={theme.labelColor} dividerColor={theme.divider} />
          <DetailRow label="Tax Amount" value={taxAmount} labelColor={theme.labelColor} dividerColor={theme.divider} />
          <DetailRow
            label="Total Amount"
            value={totalAfterTax}
            labelColor={theme.labelColor}
            dividerColor={theme.divider}
            highlight
            highlightColor={theme.accentColor}
            isLast
          />
        </div>

        {/* Vendor Details */}
        <div className="overflow-hidden rounded-lg bg-white shadow-sm">
          <SectionHeader title="Vendor Details" bg={theme.sectionHeaderBg} color={theme.accentColor} />
          <DetailRow label="Vendor Name" value={vendorName} labelColor={theme.labelColor} dividerColor={theme.divider} />
          <DetailRow label="Vendor Address" value={vendorAddress} labelColor={theme.labelColor} dividerColor={theme.divider} />
          <DetailRow label="Bank Details" value={vendorBankDetails} labelColor={theme.labelColor} dividerColor={theme.divider} isLast />
        </div>

        {/* Item Descriptions */}
        {itemDescriptions !== "—" && (
          <div className="overflow-hidden rounded-lg bg-white shadow-sm">
            <SectionHeader title="Item Descriptions" bg={theme.sectionHeaderBg} color={theme.accentColor} />
            <p className="whitespace-pre-line px-[var(--space-md)] py-[var(--space-md)] text-body-sm text-text-primary">
              {itemDescriptions}
            </p>
          </div>
        )}

        {/* Line Items */}
        {lineItems.length > 0 && (
          <div className="overflow-hidden rounded-lg bg-white shadow-sm">
            <SectionHeader title={`Line Items (${lineItems.length})`} bg={theme.sectionHeaderBg} color={theme.accentColor} />
            {lineItems.map((item, index) => (
              <div
                key={index}
                className="flex items-center gap-[var(--space-sm)] px-[var(--space-md)] py-[var(--space-sm)]"
                style={index < lineItems.length - 1 ? { borderBottom: `1px solid ${theme.divider}` } : undefined}
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-caption font-bold"
                  style={{ backgroundColor: theme.pillBg, color: theme.accentColor }}
                >
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-sm font-semibold text-text-primary">{item.description}</p>
                  {(item.quantity || item.unitPrice) && (
                    <p className="text-caption text-text-secondary">
                      {item.quantity ? `Qty: ${item.quantity}` : ""}
                      {item.quantity && item.unitPrice ? "  ·  " : ""}
                      {item.unitPrice ? `Unit: ${formatDetailAmount(item.unitPrice)}` : ""}
                    </p>
                  )}
                </div>
                <span className="shrink-0 font-extrabold" style={{ color: theme.accentColor }}>
                  {formatDetailAmount(item.amount)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Status History */}
        {statusHistory.length > 0 && (
          <div className="overflow-hidden rounded-lg bg-white shadow-sm">
            <SectionHeader title="Status History" bg={theme.sectionHeaderBg} color={theme.accentColor} />
            <div className="flex flex-col gap-[var(--space-md)] px-[var(--space-md)] py-[var(--space-md)]">
              {statusHistory.map((entry, index) => {
                const isLast = index === statusHistory.length - 1;
                return (
                  <div key={index} className="flex gap-[var(--space-sm)]">
                    <span
                      className="mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2"
                      style={{
                        backgroundColor: isLast ? theme.accentColor : "#DDDDDD",
                        borderColor: isLast ? theme.accentColor : "#CCCCCC",
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-text-primary">
                        {entry.postedStatus ? entry.postedStatus.charAt(0).toUpperCase() + entry.postedStatus.slice(1) : "—"}
                      </p>
                      {entry.changedAt && <p className="text-caption text-text-secondary">{formatDetailDate(entry.changedAt)}</p>}
                      {entry.reason && (
                        <p className="text-caption font-semibold" style={{ color: theme.accentColor }}>
                          {entry.reason}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {previewHref && (
          <Link
            href={previewHref}
            className="flex items-center justify-center gap-[var(--space-xs)] rounded-lg border-2 py-[var(--space-md)] font-bold"
            style={{ borderColor: theme.accentColor, color: theme.accentColor }}
          >
            View Original Invoice
          </Link>
        )}

        {driveFileUrl && (
          <a
            href={driveFileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-[var(--space-xs)] rounded-lg border-2 border-[#0066DA] py-[var(--space-md)] font-bold text-[#0066DA]"
          >
            <BrandIcon name="google-drive" size={18} />
            View in Google Drive
          </a>
        )}
      </div>
    </div>
  );
}
