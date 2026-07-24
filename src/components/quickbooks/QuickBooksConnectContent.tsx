"use client";

import { ArrowRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Card } from "@/components/ui/Card";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { disconnectQuickBooks, getMyQBConnections, getQuickBooksStatus } from "@/store/quickBooks/quickBooksApi";
import { connectToQuickBooks } from "@/lib/quickbooks/connect";

interface QBConnection {
  _id: string;
  name: string;
  realmId: string;
  role: string;
  createdAt: string;
}

export function QuickBooksConnectContent() {
  const dispatch = useAppDispatch();
  const accessToken = useAppSelector((state) => state.auth.user?.data?.accessToken);
  const qbConnectionId = useAppSelector((state) => state.quickBooks.qbConnectionId);

  const [connections, setConnections] = useState<QBConnection[]>([]);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    if (!accessToken) {
      setCheckingStatus(false);
      return;
    }
    setCheckingStatus(true);
    const result = await dispatch(getMyQBConnections({ accessToken }));
    if (getMyQBConnections.fulfilled.match(result)) {
      const list: QBConnection[] = result.payload?.data?.connections ?? [];
      setConnections(list);
      const first = list[0];
      if (first?._id) {
        await dispatch(getQuickBooksStatus({ accessToken, qbConnectionId: first._id }));
      }
    }
    setCheckingStatus(false);
  }, [accessToken, dispatch]);

  useEffect(() => {
    checkStatus();
    // Web equivalent of mobile's AppState-foreground listener: re-check
    // status whenever the user comes back to this tab (e.g. after
    // completing the QuickBooks OAuth redirect in this same tab, or
    // returning from another tab).
    const onFocus = () => checkStatus();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [checkStatus]);

  const handleSwitch = async (connection: QBConnection) => {
    if (connection._id === qbConnectionId) return;
    if (!accessToken) return;
    if (!window.confirm(`Switch active account to ${connection.name}?`)) return;
    await dispatch(getQuickBooksStatus({ accessToken, qbConnectionId: connection._id }));
  };

  const handleDisconnect = async (connection: QBConnection) => {
    if (!accessToken) return;
    if (!window.confirm(`Disconnect "${connection.name}"? This cannot be undone.`)) return;
    setDisconnectingId(connection._id);
    try {
      const result = await dispatch(disconnectQuickBooks({ accessToken, qbConnectionId: connection._id }));
      if (disconnectQuickBooks.fulfilled.match(result)) {
        setConnections((prev) => prev.filter((c) => c._id !== connection._id));
        await checkStatus();
      } else {
        window.alert(typeof result.payload === "string" ? result.payload : "Unable to disconnect.");
      }
    } finally {
      setDisconnectingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-2xl p-[var(--space-lg)]">
      <h1 className="text-h2 font-bold text-trust-navy">QuickBooks</h1>
      <p className="mt-[var(--space-xs)] text-body-sm text-text-secondary">
        Manage the QuickBooks companies connected to Scantrix.
      </p>

      {checkingStatus ? (
        <p className="mt-[var(--space-lg)] text-body-sm text-text-secondary">Checking accounts…</p>
      ) : (
        <div className="mt-[var(--space-lg)] flex flex-col gap-[var(--space-sm)]">
          {connections.length === 0 && (
            <Card className="text-center text-body-sm text-text-secondary">
              No QuickBooks accounts connected yet.
            </Card>
          )}

          {connections.map((connection) => {
            const isActive = connection._id === qbConnectionId;
            const date = new Date(connection.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });
            return (
              <Card key={connection._id} className={`flex items-center justify-between ${isActive ? "border-primary" : ""}`}>
                <div className="flex items-center gap-[var(--space-sm)]">
                  <span className={`h-2.5 w-2.5 rounded-full ${isActive ? "bg-primary" : "bg-border"}`} />
                  <div>
                    <p className="font-bold text-text-primary">{connection.name}</p>
                    <p className="text-caption text-text-secondary">Connected {date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-[var(--space-sm)]">
                  {isActive ? (
                    <span className="rounded-pill bg-primary px-[var(--space-sm)] py-[var(--space-xs)] text-caption font-bold text-white">
                      Active
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSwitch(connection)}
                      className="text-body-sm font-semibold text-primary"
                    >
                      Switch
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDisconnect(connection)}
                    disabled={disconnectingId === connection._id}
                    className="rounded-md bg-error/10 px-[var(--space-sm)] py-[var(--space-xs)] text-caption font-bold text-error disabled:opacity-60"
                  >
                    {disconnectingId === connection._id ? "…" : "Disconnect"}
                  </button>
                </div>
              </Card>
            );
          })}

          <button
            type="button"
            onClick={() => connectToQuickBooks()}
            className="mt-[var(--space-sm)] flex h-12 items-center justify-center gap-[var(--space-xs)] rounded-md bg-primary font-bold text-white"
          >
            {connections.length > 0 ? "Add Another Account" : "Connect QuickBooks"}
            <ArrowRight size={16} strokeWidth={2.25} />
          </button>
        </div>
      )}
    </div>
  );
}
