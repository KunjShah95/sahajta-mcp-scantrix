"use client";

import { MessageSquare, Trash2 } from "lucide-react";

import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Spinner } from "@/components/ui/Spinner";
import type { ConversationSummary } from "@/lib/chatHistory/types";

// Presentational list of the signed-in user's past conversations. Owns no
// fetching and no ownership logic — ChatPanel hands it whatever
// /api/chat/history returned, and that route only ever returns the caller's
// own records (see src/lib/chatHistory/apiAuth.ts).

/**
 * Calendar-day buckets, compared date-to-date rather than by elapsed
 * milliseconds: at 00:30, a conversation from 23:00 last night is 1.5 hours
 * old but belongs under "Yesterday", not "Today".
 */
function startOfDay(value: Date): number {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

function groupLabel(timestamp: number): string {
  const then = new Date(timestamp);
  const dayDelta = Math.round((startOfDay(new Date()) - startOfDay(then)) / 86_400_000);
  if (dayDelta <= 0) return "Today";
  if (dayDelta === 1) return "Yesterday";
  if (dayDelta < 7) return "Earlier this week";
  if (dayDelta < 30) return "Earlier this month";
  return then.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

/** Time for today's rows, date for older ones — the group heading carries the rest. */
function rowTimestamp(timestamp: number): string {
  const then = new Date(timestamp);
  const isToday = startOfDay(then) === startOfDay(new Date());
  return isToday
    ? then.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : then.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function groupByDay(conversations: ConversationSummary[]): { label: string; items: ConversationSummary[] }[] {
  const groups: { label: string; items: ConversationSummary[] }[] = [];
  for (const conversation of conversations) {
    const label = groupLabel(conversation.updatedAt);
    const current = groups.at(-1);
    if (current?.label === label) current.items.push(conversation);
    else groups.push({ label, items: [conversation] });
  }
  return groups;
}

export function ChatHistoryList({
  conversations,
  status,
  error,
  openingId,
  deletingId,
  onSelect,
  onDelete,
  onRetry,
}: {
  conversations: ConversationSummary[];
  status: "idle" | "loading" | "error";
  error: string | null;
  /** Row whose transcript is being fetched — opening is a network round trip. */
  openingId: string | null;
  deletingId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRetry: () => void;
}) {
  // Skeleton rather than a spinner for list content, per the shared primitive's
  // note in src/components/ui/Skeleton.tsx.
  if (status === "loading" && conversations.length === 0) {
    return (
      <div className="flex-1 space-y-[var(--space-md)] px-[var(--space-lg)] py-[var(--space-md)]" role="status" aria-label="Loading chat history">
        {[0, 1, 2, 3].map((row) => (
          <div key={row}>
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="mt-[var(--space-xs)] h-3 w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (status === "error" && conversations.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center overflow-y-auto">
        <ErrorState message={error ?? undefined} onRetry={onRetry} />
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center overflow-y-auto">
        <EmptyState
          icon={<MessageSquare size={28} strokeWidth={1.75} />}
          title="No conversations yet"
          description="Ask the assistant about your invoices, vendors, or spend and the conversation will show up here."
        />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto py-[var(--space-xs)]">
      {/* A failed delete, refresh, or open with rows still on screen: keep the
          list usable and report the problem above it rather than replacing it.
          Not gated on `status` — a failed *open* leaves the list itself fine. */}
      {error && (
        <p role="alert" className="px-[var(--space-lg)] py-[var(--space-xs)] text-caption text-error">
          {error}
        </p>
      )}

      {groupByDay(conversations).map(({ label, items }) => (
        <div key={label}>
          <p className="sticky top-0 z-10 bg-white px-[var(--space-lg)] py-[var(--space-xs)] text-caption font-semibold uppercase tracking-wide text-text-secondary">
            {label}
          </p>
          {items.map((conversation) => {
            const busy = openingId === conversation.id || deletingId === conversation.id;
            return (
            <div key={conversation.id} className="flex items-center gap-[var(--space-xs)] px-[var(--space-sm)] hover:bg-background-alt">
              {/* A real button, not a clickable div — this is the list's
                  primary action and has to be keyboard reachable. The delete
                  control is a sibling, never nested inside it. */}
              <button
                type="button"
                onClick={() => onSelect(conversation.id)}
                disabled={busy}
                aria-busy={openingId === conversation.id}
                className="min-w-0 flex-1 rounded-md px-[var(--space-sm)] py-[var(--space-sm)] text-left outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
              >
                <span className="block truncate text-body-sm text-text-primary">{conversation.title}</span>
                <span className="mt-0.5 block text-caption text-text-secondary">
                  {rowTimestamp(conversation.updatedAt)} · {conversation.messageCount}{" "}
                  {conversation.messageCount === 1 ? "message" : "messages"}
                </span>
              </button>
              {/* Opening and deleting both take a round trip; the row shows
                  which one is in flight instead of looking inert. */}
              {busy ? (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center">
                  <Spinner size="sm" />
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onDelete(conversation.id)}
                  aria-label={`Delete conversation: ${conversation.title}`}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-secondary outline-none hover:bg-white hover:text-error focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Trash2 size={15} strokeWidth={2} />
                </button>
              )}
            </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
