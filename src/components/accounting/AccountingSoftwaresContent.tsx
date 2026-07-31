"use client";

import { ArrowRight, ChevronRight, Receipt, X } from "lucide-react";
import { ReactNode, useCallback, useEffect, useState } from "react";

import { BrandIcon } from "@/components/icons/BrandIcon";
import { confirmDialog, showToast } from "@/lib/dialogManager";
import { capitalizeWords } from "@/lib/textFormat";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { connectGoogleDrive, getGoogleDriveStatus, disconnectGoogleDrive } from "@/store/googleDrive/googleDriveApi";
import { useQuickBooksConnections } from "@/store/quickBooks/useQuickBooksConnections";

function SoftwareCard({
  icon,
  name,
  description,
  status,
  statusClassName,
  disabled,
  active,
  expandable,
  onClick,
}: {
  icon: ReactNode;
  name: string;
  description: string;
  status: string;
  statusClassName: string;
  disabled?: boolean;
  active?: boolean;
  expandable?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <div
      className={`flex items-center gap-[var(--space-md)] rounded-lg bg-white p-[var(--space-md)] shadow-sm ${
        disabled ? "opacity-60" : active ? "ring-2 ring-primary/40" : "hover:bg-background-alt"
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
      {expandable && (
        <ChevronRight
          size={18}
          strokeWidth={2}
          className={`shrink-0 text-text-secondary transition-transform ${active ? "rotate-90" : ""}`}
        />
      )}
    </div>
  );

  if (disabled) return content;
  return (
    <button type="button" onClick={onClick} className="block w-full text-left">
      {content}
    </button>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-[var(--space-sm)] py-[var(--space-sm)]">
      <span className="shrink-0 text-body-sm text-text-secondary">{label}</span>
      <span className="min-w-0 truncate text-right text-body-sm font-semibold text-text-primary">{value}</span>
    </div>
  );
}

function formatConnectedDate(value?: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function AccountingSoftwaresContent() {
  const dispatch = useAppDispatch();
  const { connected, statusLoading } = useAppSelector((state) => state.quickBooks);

  const [driveConnected, setDriveConnected] = useState(false);
  const [driveStatusLoading, setDriveStatusLoading] = useState(true);
  const [driveConnecting, setDriveConnecting] = useState(false);
  const [driveDisconnecting, setDriveDisconnecting] = useState(false);
  const [driveEmail, setDriveEmail] = useState<string | null>(null);
  const [driveConnectedAt, setDriveConnectedAt] = useState<string | null>(null);
  const [driveFolderUrl, setDriveFolderUrl] = useState<string | null>(null);
  const [driveExpanded, setDriveExpanded] = useState(false);

  const [qbExpanded, setQbExpanded] = useState(false);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);

  const {
    connections,
    checkingStatus,
    connecting,
    disconnectingId,
    reconnectingId,
    activeConnectionId,
    handleConnect,
    handleSwitch,
    handleReconnect,
    handleDisconnect,
  } = useQuickBooksConnections("/accounting-software");

  const selectedConnection = connections.find((c) => c._id === selectedConnectionId) || null;

  const checkDriveStatus = useCallback(async () => {
    setDriveStatusLoading(true);
    const result = await dispatch(getGoogleDriveStatus());
    if (getGoogleDriveStatus.fulfilled.match(result)) {
      const data = result.payload?.data;
      setDriveConnected(Boolean(data?.connected));
      setDriveEmail(data?.email ?? null);
      setDriveConnectedAt(data?.connectedAt ?? null);
      setDriveFolderUrl(data?.folderUrl ?? null);
    }
    setDriveStatusLoading(false);
  }, [dispatch]);

  useEffect(() => {
    checkDriveStatus();
    // Re-check on focus: covers returning from the Google OAuth redirect (the
    // /google-drive landing page bounces back here) and a disconnect done in
    // another tab.
    const onFocus = () => checkDriveStatus();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [checkDriveStatus]);

  const handleDriveDisconnect = async () => {
    const confirmed = await confirmDialog({
      title: "Disconnect Google Drive?",
      message: "Scantrix will stop saving copies of posted invoices to your Drive. This cannot be undone.",
      confirmLabel: "Disconnect",
      tone: "destructive",
    });
    if (!confirmed) return;
    setDriveDisconnecting(true);
    try {
      const result = await dispatch(disconnectGoogleDrive());
      if (disconnectGoogleDrive.fulfilled.match(result)) {
        setDriveConnected(false);
        setDriveEmail(null);
        setDriveConnectedAt(null);
        setDriveFolderUrl(null);
        setDriveExpanded(false);
      } else {
        const payload = result.payload as { message?: string } | undefined;
        showToast(payload?.message || "Could not disconnect. Please try again.", "error");
      }
    } finally {
      setDriveDisconnecting(false);
    }
  };

  // Also used as "Reconnect" for an already-connected account — Drive has no
  // per-connection id like QuickBooks does (it's 1:1 with the current QB
  // workspace), so re-running the same OAuth flow (server always forces
  // prompt=consent) is what refreshes/re-authorizes it.
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

  // Opening either integration's panel closes the other's — only one side
  // panel makes sense at a time given they share the same column.
  const handleDriveClick = () => {
    if (driveConnected) {
      setQbExpanded(false);
      setSelectedConnectionId(null);
      setDriveExpanded((prev) => !prev);
    } else {
      handleDriveConnect();
    }
  };

  const handleQuickBooksClick = () => {
    setDriveExpanded(false);
    setQbExpanded((prev) => {
      const next = !prev;
      if (!next) setSelectedConnectionId(null);
      return next;
    });
  };

  const handleDisconnectSelected = async () => {
    if (!selectedConnection) return;
    const success = await handleDisconnect(selectedConnection);
    if (success) setSelectedConnectionId(null);
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

  const anyPaneOpen = qbExpanded || driveExpanded;

  return (
    <div className="mx-auto max-w-6xl p-[var(--space-lg)]">
      <h1 className="text-h2 font-bold text-trust-navy">Connect your software</h1>
      <p className="mt-[var(--space-xs)] text-body-sm text-text-secondary">
        Choose the accounting software you want to sync with Scantrix.
      </p>

      <div className="mt-[var(--space-lg)] flex flex-col items-start gap-[var(--space-lg)] lg:flex-row">
        <div className={`w-full ${anyPaneOpen ? "lg:w-[360px] lg:shrink-0" : "max-w-2xl"}`}>
          <p className="mb-[var(--space-sm)] text-caption font-bold uppercase tracking-wide text-text-secondary">
            Available
          </p>
          <div className="flex flex-col gap-[var(--space-sm)]">
            <SoftwareCard
              icon={<BrandIcon name="quickbooks" size={28} />}
              name="QuickBooks"
              description="Sync vendors and post invoices automatically."
              status={qbStatusLabel}
              statusClassName={qbStatusClass}
              onClick={handleQuickBooksClick}
              active={qbExpanded}
              expandable
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
              active={driveExpanded}
              expandable={driveConnected}
            />
          </div>

          <p className="mb-[var(--space-sm)] mt-[var(--space-xl)] text-caption font-bold uppercase tracking-wide text-text-secondary">
            Coming soon
          </p>
          <div className="flex flex-col gap-[var(--space-sm)]">
            <SoftwareCard
              icon={<BrandIcon name="sage" size={28} />}
              name="Sage"
              description="Sync Sage Business Cloud Accounting with Scantrix."
              status="Coming Soon"
              statusClassName="bg-background-alt text-text-secondary"
              disabled
            />
            <SoftwareCard
              icon={<BrandIcon name="xero" size={28} />}
              name="Xero"
              description="Automate invoice posting and reconciliation with Xero."
              status="Coming Soon"
              statusClassName="bg-background-alt text-text-secondary"
              disabled
            />
            <SoftwareCard
              icon={<Receipt size={26} strokeWidth={1.75} className="text-text-secondary" />}
              name="FreshBooks"
              description="Connect FreshBooks to sync bills and expenses."
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

        {qbExpanded && (
          <div className="w-full lg:w-80 lg:shrink-0">
            <div className="overflow-hidden rounded-lg border border-border bg-white">
              <div className="flex items-center justify-between gap-[var(--space-sm)] border-b border-border p-[var(--space-md)]">
                <div className="min-w-0">
                  <p className="font-bold text-text-primary">Connected accounts</p>
                  <p className="truncate text-caption text-text-secondary">QuickBooks companies linked to Scantrix</p>
                </div>
                <button
                  type="button"
                  onClick={handleQuickBooksClick}
                  aria-label="Close"
                  className="shrink-0 text-text-secondary hover:text-text-primary"
                >
                  <X size={18} strokeWidth={2} />
                </button>
              </div>

              <div className="flex flex-col gap-[var(--space-xs)] p-[var(--space-sm)]">
                {checkingStatus ? (
                  <p className="p-[var(--space-md)] text-center text-body-sm text-text-secondary">Checking accounts…</p>
                ) : connections.length === 0 ? (
                  <p className="p-[var(--space-md)] text-center text-body-sm text-text-secondary">
                    No QuickBooks accounts connected yet.
                  </p>
                ) : (
                  connections.map((connection) => {
                    const isActive = connection._id === activeConnectionId;
                    const isSelected = connection._id === selectedConnectionId;
                    const canReconnect = connection.role === "owner" || connection.role === "admin";
                    return (
                      <div
                        key={connection._id}
                        className={`rounded-md p-[var(--space-sm)] ${isSelected ? "bg-primary-50" : "hover:bg-background-alt"}`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedConnectionId(connection._id)}
                          className="flex w-full items-center gap-[var(--space-sm)] text-left"
                        >
                          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${isActive ? "bg-primary" : "bg-border"}`} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold text-text-primary">{connection.name}</span>
                            {isActive && <span className="block text-caption text-primary-700">Active</span>}
                          </span>
                          <ChevronRight size={16} strokeWidth={2} className="shrink-0 text-text-secondary" />
                        </button>
                        <div className="mt-[var(--space-xs)] flex items-center gap-[var(--space-md)] pl-[calc(0.625rem+var(--space-sm))]">
                          {!isActive && (
                            <button
                              type="button"
                              onClick={() => handleSwitch(connection)}
                              className="text-caption font-semibold text-primary hover:underline"
                            >
                              Switch
                            </button>
                          )}
                          {canReconnect && (
                            <button
                              type="button"
                              onClick={() => handleReconnect(connection)}
                              disabled={reconnectingId === connection._id}
                              className="text-caption font-semibold text-primary hover:underline disabled:opacity-60"
                            >
                              {reconnectingId === connection._id ? "Reconnecting…" : "Reconnect"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="border-t border-border p-[var(--space-sm)]">
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={connecting}
                  className="flex h-11 w-full items-center justify-center gap-[var(--space-xs)] rounded-md bg-primary font-bold text-white disabled:opacity-60"
                >
                  {connecting ? "Connecting…" : "Add Another Account"}
                  <ArrowRight size={14} strokeWidth={2.25} />
                </button>
              </div>
            </div>
          </div>
        )}

        {selectedConnection && (
          <div className="w-full lg:w-80 lg:shrink-0">
            <div className="rounded-lg border border-border bg-white p-[var(--space-lg)]">
              <div className="flex items-start justify-between gap-[var(--space-sm)]">
                <div className="min-w-0">
                  <p className="truncate font-bold text-text-primary">{selectedConnection.name}</p>
                  <p className="text-caption text-text-secondary">
                    {selectedConnection._id === activeConnectionId ? "Active connection" : "Inactive"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedConnectionId(null)}
                  aria-label="Close"
                  className="shrink-0 text-text-secondary hover:text-text-primary"
                >
                  <X size={18} strokeWidth={2} />
                </button>
              </div>

              <div className="mt-[var(--space-md)] flex flex-col divide-y divide-border">
                <DetailRow label="Connected on" value={formatConnectedDate(selectedConnection.createdAt)} />
                <DetailRow label="Realm ID" value={selectedConnection.realmId} />
                <DetailRow label="User type" value={capitalizeWords(selectedConnection.role)} />
              </div>

              <div className="mt-[var(--space-lg)] flex flex-col gap-[var(--space-sm)]">
                {selectedConnection._id !== activeConnectionId && (
                  <button
                    type="button"
                    onClick={() => handleSwitch(selectedConnection)}
                    className="h-11 w-full rounded-md border border-border font-bold text-text-primary hover:bg-background-alt"
                  >
                    Switch to this account
                  </button>
                )}
                {(selectedConnection.role === "owner" || selectedConnection.role === "admin") && (
                  <button
                    type="button"
                    onClick={() => handleReconnect(selectedConnection)}
                    disabled={reconnectingId === selectedConnection._id}
                    className="h-11 w-full rounded-md border border-border font-bold text-text-primary hover:bg-background-alt disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {reconnectingId === selectedConnection._id ? "Reconnecting…" : "Reconnect"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleDisconnectSelected}
                  disabled={disconnectingId === selectedConnection._id}
                  className="h-11 w-full rounded-md bg-error/10 font-bold text-error disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {disconnectingId === selectedConnection._id ? "Disconnecting…" : "Disconnect"}
                </button>
              </div>
            </div>
          </div>
        )}

        {driveExpanded && driveConnected && (
          <div className="w-full lg:w-80 lg:shrink-0">
            <div className="rounded-lg border border-border bg-white p-[var(--space-lg)]">
              <div className="flex items-start justify-between gap-[var(--space-sm)]">
                <div className="min-w-0">
                  <p className="truncate font-bold text-text-primary">Google Drive</p>
                  <p className="text-caption text-text-secondary">Connected account details</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDriveExpanded(false)}
                  aria-label="Close"
                  className="shrink-0 text-text-secondary hover:text-text-primary"
                >
                  <X size={18} strokeWidth={2} />
                </button>
              </div>

              <div className="mt-[var(--space-md)] flex flex-col divide-y divide-border">
                <DetailRow label="Gmail account" value={driveEmail || "—"} />
                <DetailRow label="Connected on" value={formatConnectedDate(driveConnectedAt)} />
                <DetailRow
                  label="Drive folder"
                  value={
                    driveFolderUrl ? (
                      <a
                        href={driveFolderUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-primary-700 hover:underline"
                      >
                        Open folder
                      </a>
                    ) : (
                      "Created after first invoice"
                    )
                  }
                />
              </div>

              <div className="mt-[var(--space-lg)] flex flex-col gap-[var(--space-sm)]">
                <button
                  type="button"
                  onClick={handleDriveConnect}
                  disabled={driveConnecting}
                  className="h-11 w-full rounded-md border border-border font-bold text-text-primary hover:bg-background-alt disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {driveConnecting ? "Reconnecting…" : "Reconnect"}
                </button>
                <button
                  type="button"
                  onClick={handleDriveDisconnect}
                  disabled={driveDisconnecting}
                  className="h-11 w-full rounded-md bg-error/10 font-bold text-error disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {driveDisconnecting ? "Disconnecting…" : "Disconnect"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
