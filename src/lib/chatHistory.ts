import type { ChatMessage } from "@/store/chat/chatSlice";

const STORAGE_KEY = "savetrix_chat_history_v1";
const MAX_CONVERSATIONS = 50;

export interface ConversationRecord {
  id: string;
  userEmail: string;
  qbConnectionId: string;
  startedAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  preview: string;
}

function readAll(): ConversationRecord[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeAll(records: ConversationRecord[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function saveConversation(record: ConversationRecord): void {
  const all = readAll().filter((r) => r.id !== record.id);
  all.unshift(record);
  writeAll(all.slice(0, MAX_CONVERSATIONS));
}

export function loadConversations(userEmail: string, qbConnectionId: string): ConversationRecord[] {
  return readAll().filter((r) => r.userEmail === userEmail && r.qbConnectionId === qbConnectionId);
}

export function deleteConversation(id: string): void {
  writeAll(readAll().filter((r) => r.id !== id));
}

export function buildPreview(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "Empty conversation";
  return first.content.length > 80 ? first.content.slice(0, 77) + "…" : first.content;
}
