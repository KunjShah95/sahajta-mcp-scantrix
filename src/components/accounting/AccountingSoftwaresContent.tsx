"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";

import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { getMyQBConnections } from "@/store/quickBooks/quickBooksApi";

const DRIVE_CONNECTED_STORAGE_KEY = "driveConnected";

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
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-background-alt text-2xl">
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

  useEffect(() => {
    if (accessToken) dispatch(getMyQBConnections({ accessToken }));
    setDriveConnected(window.localStorage.getItem(DRIVE_CONNECTED_STORAGE_KEY) === "true");
  }, [accessToken, dispatch]);

  // Mockup only — see ASSUMPTIONS.md (C9): the mobile source actually calls a
  // real /google-drive/connect + /google-drive/status backend pair, but this
  // was explicitly pre-scoped (TASKS.md + ASSUMPTIONS.md, before this loop
  // started) to stay a client-side-only mockup for this pass. Toggles a
  // localStorage flag, no network call.
  const handleToggleDrive = () => {
    const next = !driveConnected;
    setDriveConnected(next);
    window.localStorage.setItem(DRIVE_CONNECTED_STORAGE_KEY, next ? "true" : "false");
  };

  const qbStatusLabel = statusLoading ? "Checking…" : connected ? "Connected" : "Not connected";
  const qbStatusClass = connected ? "bg-success/10 text-success" : "bg-warning/10 text-warning";

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
          icon="🟢"
          name="QuickBooks"
          description="Sync vendors and post invoices automatically."
          status={qbStatusLabel}
          statusClassName={qbStatusClass}
          href="/quickbooks"
        />
        <SoftwareCard
          icon="📁"
          name="Google Drive"
          description={driveConnected ? "Read-only access granted." : "Connect to grant read-only access to your Drive files."}
          status={driveConnected ? "Connected" : "Not connected"}
          statusClassName={driveConnected ? "bg-[#0066DA]/10 text-[#0066DA]" : "bg-background-alt text-text-secondary"}
          onClick={handleToggleDrive}
        />
      </div>

      <p className="mb-[var(--space-sm)] mt-[var(--space-xl)] text-caption font-bold uppercase tracking-wide text-text-secondary">
        Coming soon
      </p>
      <div className="flex flex-col gap-[var(--space-sm)]">
        <SoftwareCard
          icon="📊"
          name="Tally"
          description="Connect Tally to manage accounting entries and GST reports."
          status="Coming Soon"
          statusClassName="bg-background-alt text-text-secondary"
          disabled
        />
        <SoftwareCard
          icon="📘"
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
