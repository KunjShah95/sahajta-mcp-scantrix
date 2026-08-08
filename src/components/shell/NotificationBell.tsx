"use client";

import { Bell, CheckCircle2, Info, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  NOTIFICATIONS_CHANGED,
  NotificationItem,
  dialogEmitter,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/dialogManager";

const NOTIFICATION_ICON = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
} as const;

const NOTIFICATION_ICON_CLASS = {
  success: "text-success",
  error: "text-error",
  info: "text-trust-navy",
} as const;

function formatRelativeTime(timestamp: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const PREVIEW_DURATION_MS = 4000;

// Reads/writes the same in-memory history dialogManager.ts builds from every
// showToast() call — QuickBooks sync, vendor/GL/tax-code sync, invoices,
// auth, etc. — so this dropdown is a live log of everything the app has
// already been telling the user via toast, not a separate feed to keep wired
// up per feature.
export function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const [preview, setPreview] = useState<NotificationItem | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastTopIdRef = useRef<number | null>(null);

  useEffect(() => {
    const seeded = getNotifications();
    setNotifications(seeded);
    lastTopIdRef.current = seeded[0]?.id ?? null;

    const onChange = (next: NotificationItem[]) => setNotifications(next);
    dialogEmitter.on(NOTIFICATIONS_CHANGED, onChange);
    return () => {
      dialogEmitter.off(NOTIFICATIONS_CHANGED, onChange);
    };
  }, []);

  // Every fresh notification (new top-of-list id — mark-read/mark-all-read
  // updates rewrite the same entries in place, so they don't count) gets a
  // short-lived preview bubble anchored right under the bell, so the text
  // shows up "linked" to the icon the moment it arrives instead of only
  // being logged silently into the dropdown until someone clicks in.
  useEffect(() => {
    const top = notifications[0] ?? null;
    if (top && top.id !== lastTopIdRef.current) {
      lastTopIdRef.current = top.id;
      setPreview(top);
    }
  }, [notifications]);

  // Kept separate from the detection effect above: that effect re-runs on
  // every notifications change (including mark-read updates), which would
  // cancel this timer before it ever fires if the two were combined.
  useEffect(() => {
    if (!preview) return;
    const timeout = setTimeout(() => setPreview(null), PREVIEW_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [preview]);

  // Relative timestamps ("2m ago") depend on the current time, which must
  // not be read during the initial server/client render (hydration
  // mismatch) — computed after mount instead, same guard other
  // client-only-value reads use elsewhere in this app.
  useEffect(() => {
    if (!open) return;
    setNow(Date.now());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Opening the dropdown is the "I've seen these" signal — no separate
  // mark-all-read click needed. Also dismisses any preview bubble still
  // showing, since its message is now visible in the list below it.
  const handleToggle = () => {
    setOpen((prevOpen) => {
      const nextOpen = !prevOpen;
      if (nextOpen) {
        markAllNotificationsRead();
        setPreview(null);
      }
      return nextOpen;
    });
  };

  const PreviewIcon = preview ? NOTIFICATION_ICON[preview.tone] : null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        onClick={handleToggle}
        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border text-text-secondary hover:bg-background-alt"
      >
        <Bell size={18} strokeWidth={2} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold leading-none text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Transient preview, distinct from the dropdown — appears the moment
          a notification arrives, directly under the bell, with a caret
          pointing back up at it so the connection reads as intentional
          rather than a stray toast. Hidden while the dropdown itself is
          open to avoid showing the same message twice. */}
      {preview && !open && PreviewIcon && (
        <div className="absolute right-0 top-12 z-[100] w-72 rounded-lg border border-border bg-white shadow-xl">
          <span className="absolute -top-1.5 right-3 h-3 w-3 rotate-45 border-l border-t border-border bg-white" />
          <div className="relative flex items-start gap-[var(--space-sm)] rounded-lg bg-white p-[var(--space-md)]">
            <PreviewIcon size={16} strokeWidth={2} className={`mt-0.5 shrink-0 ${NOTIFICATION_ICON_CLASS[preview.tone]}`} />
            <p className="min-w-0 flex-1 text-body-sm font-medium text-text-primary">{preview.message}</p>
          </div>
        </div>
      )}

      {open && (
        <div className="absolute right-0 top-12 z-[100] flex max-h-96 w-80 flex-col overflow-hidden rounded-lg border border-border bg-white shadow-xl">
          <div className="flex shrink-0 items-center border-b border-border px-[var(--space-md)] py-[var(--space-sm)]">
            <h3 className="text-body-sm font-bold text-text-primary">Notifications</h3>
          </div>

          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-[var(--space-md)] py-[var(--space-lg)] text-center text-body-sm text-text-secondary">
                No notifications yet.
              </p>
            ) : (
              notifications.map((notification) => {
                const Icon = NOTIFICATION_ICON[notification.tone];
                return (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => markNotificationRead(notification.id)}
                    className={`flex w-full items-start gap-[var(--space-sm)] border-b border-border px-[var(--space-md)] py-[var(--space-sm)] text-left last:border-b-0 hover:bg-background-alt ${
                      notification.read ? "" : "bg-primary-50/50"
                    }`}
                  >
                    <Icon size={16} strokeWidth={2} className={`mt-0.5 shrink-0 ${NOTIFICATION_ICON_CLASS[notification.tone]}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-body-sm text-text-primary">{notification.message}</p>
                      <p className="mt-0.5 text-caption text-text-secondary">
                        {now === null ? "" : formatRelativeTime(notification.timestamp, now)}
                      </p>
                    </div>
                    {!notification.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary-500" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
