"use client";

import Link from "next/link";
import { Calculator } from "lucide-react";
import { ReactNode, useCallback, useEffect, useState } from "react";

import { BrandIcon } from "@/components/icons/BrandIcon";
import { confirmDialog, showToast } from "@/lib/dialogManager";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { getMyQBConnections } from "@/store/quickBooks/quickBooksApi";
import { connectGoogleDrive, getGoogleDriveStatus, disconnectGoogleDrive } from "@/store/googleDrive/googleDriveApi";

function SoftwareCard({
  icon,
  name,
  description,
  status,
  statusClassName,
  disabled,
  href,
  onClick,
}: {
  icon: ReactNode;
  name: string;
  description: string;
  status: string;
  statusClassName: string;
  disabled?: boolean;
  href?: string;
  onClick?: () => void;
}) {
  const content = (
    <div
      className={`flex items-center gap-[var(--space-md)] rounded-lg bg-white p-[var(--space-md)] shadow-sm ${
        disabled ? "opacity-60" : "hover:bg-background-alt"
      }`}
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-background-alt">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-text-primary">{name}</p>
        <p className="truncate text-caption text-text-secondary">{description}</p>
      </div>
      <span className={`shrink-0 rounded-pill px-[var(--space-sm)] py-[var(--space-xs)] text-caption font-bold ${statusClassName}`}>
        {status}
      </span>
    </div>
  );

  if (disabled) return content;
  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className="block w-full text-left">
      {content}
    </button>
  );
}

export function AccountingSoftwaresContent() {
  const dispatch = useAppDispatch();
  const accessToken = useAppSelector((state) => state.auth.user?.data?.accessToken);
  const { connected, statusLoading } = useAppSelector((state) => state.quickBooks);

  const [driveConnected, setDriveConnected] = useState(false);
  const [driveStatusLoading, setDriveStatusLoading] = useState(true);
  const [driveConnecting, setDriveConnecting] = useState(false);

  const checkDriveStatus = useCallback(async () => {
    setDriveStatusLoading(true);
    const result = await dispatch(getGoogleDriveStatus());
    if (getGoogleDriveStatus.fulfilled.match(result)) {
      setDriveConnected(Boolean(result.payload?.data?.connected));
    }
    setDriveStatusLoading(false);
  }, [dispatch]);

  useEffect(() => {
    if (accessToken) dispatch(getMyQBConnections({ accessToken }));
    checkDriveStatus();
    // Re-check on focus: covers returning from the Google OAuth redirect (the
    // /google-drive landing page bounces back here) and a disconnect done in
    // another tab.
    const onFocus = () => checkDriveStatus();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [accessToken, dispatch, checkDriveStatus]);

  const handleDriveDisconnect = async () => {
    const confirmed = await confirmDialog({
      title: "Disconnect Google Drive?",
      message: "Scantrix will stop saving copies of posted invoices to your Drive. This cannot be undone.",
      confirmLabel: "Disconnect",
      tone: "destructive",
    });
    if (!confirmed) return;
    const result = await dispatch(disconnectGoogleDrive());
    if (disconnectGoogleDrive.fulfilled.match(result)) {
      setDriveConnected(false);
    } else {
      const payload = result.payload as { message?: string } | undefined;
      showToast(payload?.message || "Could not disconnect. Please try again.", "error");
    }
  };

  const handleDriveConnect = async () => {
    setDriveConnecting(true);
    try {
      const redirectUri = `${window.location.origin}/`;
      const result = await dispatch(connectGoogleDrive({ redirectUri }));
      if (connectGoogleDrive.fulfilled.match(result)) {
        const url = result.payload?.data?.url;
        if (url) {
          window.location.href = url;
          return;
        }
        showToast("Could not start Google Drive connection. Please try again.", "error");
      } else {
        const payload = result.payload as { message?: string } | undefined;
        showToast(
          payload?.message === "X-QB-Id header is required"
            ? "Connect a QuickBooks company first — Google Drive is linked to your QuickBooks workspace."
            : payload?.message || "Could not start Google Drive connection. Please try again.",
          "error",
        );
      }
    } finally {
      setDriveConnecting(false);
    }
  };

  const handleDriveClick = () => {
    if (driveConnected) {
      handleDriveDisconnect();
    } else {
      handleDriveConnect();
    }
  };

  const qbStatusLabel = statusLoading ? "Checking…" : connected ? "Connected" : "Not connected";
  const qbStatusClass = connected ? "bg-success/10 text-success" : "bg-warning/10 text-warning";

  const driveStatusLabel = driveConnecting ? "Connecting…" : driveStatusLoading ? "Checking…" : driveConnected ? "Connected" : "Not connected";
  const driveStatusClass =
    driveConnecting || driveStatusLoading
      ? "bg-warning/10 text-warning"
      : driveConnected
        ? "bg-[#0066DA]/10 text-[#0066DA]"
        : "bg-background-alt text-text-secondary";

  return (
    <div className="mx-auto max-w-2xl p-[var(--space-lg)]">
      <h1 className="text-h2 font-bold text-trust-navy">Connect your software</h1>
      <p className="mt-[var(--space-xs)] text-body-sm text-text-secondary">
        Choose the accounting software you want to sync with Scantrix.
      </p>

      <p className="mb-[var(--space-sm)] mt-[var(--space-lg)] text-caption font-bold uppercase tracking-wide text-text-secondary">
        Available
      </p>
      <div className="flex flex-col gap-[var(--space-sm)]">
        <SoftwareCard
          icon={<BrandIcon name="quickbooks" size={28} />}
          name="QuickBooks"
          description="Sync vendors and post invoices automatically."
          status={qbStatusLabel}
          statusClassName={qbStatusClass}
          href="/quickbooks"
        />
        <SoftwareCard
          icon={<BrandIcon name="google-drive" size={28} />}
          name="Google Drive"
          description={
            driveConnected
              ? "Posted invoices are copied to your Drive automatically."
              : "Connect to save a copy of every posted invoice to your Drive."
          }
          status={driveStatusLabel}
          statusClassName={driveStatusClass}
          onClick={handleDriveClick}
          disabled={driveConnecting || driveStatusLoading}
        />
      </div>

      <p className="mb-[var(--space-sm)] mt-[var(--space-xl)] text-caption font-bold uppercase tracking-wide text-text-secondary">
        Coming soon
      </p>
      <div className="flex flex-col gap-[var(--space-sm)]">
        <SoftwareCard
          icon={<Calculator size={26} strokeWidth={1.75} className="text-text-secondary" />}
          name="Tally"
          description="Connect Tally to manage accounting entries and GST reports."
          status="Coming Soon"
          statusClassName="bg-background-alt text-text-secondary"
          disabled
        />
        <SoftwareCard
          icon={<BrandIcon name="zoho" size={28} />}
          name="Zoho Books"
          description="Automate invoice posting and reconciliation with Zoho Books."
          status="Coming Soon"
          statusClassName="bg-background-alt text-text-secondary"
          disabled
        />
      </div>
    </div>
  );
}
