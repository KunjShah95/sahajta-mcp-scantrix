"use client";

import { Trash2 } from "lucide-react";

import type { ConversationRecord } from "@/lib/chatHistory";

function formatGroupLabel(timestamp: number): string {
  const d = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return "This week";
  if (diffDays < 30) return "This month";
  return d.toLocaleString("default", { month: "long", year: "numeric" });
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function groupByDate(records: ConversationRecord[]): { label: string; items: ConversationRecord[] }[] {
  const groups: Map<string, ConversationRecord[]> = new Map();
  for (const r of records) {
    const label = formatGroupLabel(r.startedAt);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(r);
  }
  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

interface Props {
  records: ConversationRecord[];
  onSelect: (record: ConversationRecord) => void;
  onDelete: (id: string) => void;
}

export function ChatHistory({ records, onSelect, onDelete }: Props) {
  if (records.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-[var(--space-lg)]">
        <p className="text-center text-body-sm text-text-secondary">No previous conversations for this company.</p>
      </div>
    );
  }

  const groups = groupByDate(records);

  return (
    <div className="flex-1 overflow-y-auto">
      {groups.map(({ label, items }) => (
        <div key={label}>
          <p className="sticky top-0 bg-white px-[var(--space-lg)] py-[var(--space-xs)] text-caption font-semibold uppercase tracking-wide text-text-secondary">
            {label}
          </p>
          {items.map((record) => (
            <div
              key={record.id}
              className="group flex cursor-pointer items-start gap-[var(--space-sm)] px-[var(--space-lg)] py-[var(--space-sm)] hover:bg-background-alt"
              onClick={() => onSelect(record)}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-body-sm text-text-primary">{record.preview}</p>
                <p className="text-caption text-text-secondary">{formatTime(record.updatedAt)}</p>
              </div>
              <button
                type="button"
                aria-label="Delete conversation"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(record.id);
                }}
                className="mt-0.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 text-text-secondary hover:text-red-500"
              >
                <Trash2 size={15} strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
