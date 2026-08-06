// Wire types shared by the chat-history route handlers and the browser code
// that calls them. Deliberately free of imports and side effects so both the
// server (`store.ts`, `route.ts`) and the client bundle (`chatApi.ts`,
// `ChatHistoryList.tsx`) can depend on it without dragging server-only
// modules (@vercel/blob, node:crypto) into the browser build.

export type ChatRole = "user" | "assistant";

export interface StoredChatMessage {
  id: string;
  role: ChatRole;
  content: string;
}

/** What the history list renders — no message bodies, so listing stays cheap. */
export interface ConversationSummary {
  id: string;
  /** First user message, trimmed — see buildTitle in store.ts. */
  title: string;
  /** QuickBooks company the conversation was held against. */
  qbConnectionId: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

export interface Conversation extends ConversationSummary {
  messages: StoredChatMessage[];
}

/**
 * Hard caps enforced SERVER-side in store.ts. The client is never trusted to
 * respect them — a hand-rolled POST can carry any payload, so the route
 * truncates rather than rejects (a user shouldn't lose a conversation because
 * it grew long).
 */
export const MAX_CONVERSATIONS_PER_USER = 50;
export const MAX_MESSAGES_PER_CONVERSATION = 200;
export const MAX_MESSAGE_CHARS = 8_000;
/** Whole-document ceiling; oldest conversations are dropped until it fits. */
export const MAX_DOCUMENT_BYTES = 1_000_000;
