// Chat-history collection endpoint: list the caller's conversations, and save
// (create or update) one.
//
// Every path below keys storage off `context.userId`, which comes from
// lib/chatHistory/apiAuth.ts -> identity.ts and is verified against the
// Savetrix backend on the server. Nothing in the query string or body can
// widen that: a `userId`/`userEmail` in the payload is simply ignored.
//
// node runtime because the store hashes with node:crypto and talks to
// @vercel/blob — same reasoning as /api/chat (architecture doc §4.6).
export const runtime = "nodejs";
// Reads/writes are a single blob round trip; nothing here needs /api/chat's
// long tool-calling budget.
export const maxDuration = 30;

import { authorizeHistoryRequest } from "@/lib/chatHistory/apiAuth";
import { ChatHistoryStoreError, listConversations, upsertConversation } from "@/lib/chatHistory/store";

/** Guard against an oversized body before we spend memory parsing it. */
const MAX_BODY_BYTES = 2_000_000;

export async function GET(request: Request) {
  const auth = await authorizeHistoryRequest(request);
  if (!auth.ok) return auth.response;

  try {
    // Scoped to the active QuickBooks company when the client says which one
    // it's looking at — a conversation about Company A's invoices isn't useful
    // (or accurate) while the header switcher is on Company B, which is why
    // ChatWidget already clears the live conversation on that switch
    // (architecture doc §5, §7.8). This is a relevance filter layered on top
    // of per-user isolation, not a substitute for it.
    const conversations = await listConversations(auth.context.userId, auth.context.qbConnectionId ?? undefined);
    return Response.json({ conversations }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return storeFailure(error, "list");
  }
}

export async function POST(request: Request) {
  const auth = await authorizeHistoryRequest(request);
  if (!auth.ok) return auth.response;

  if (!auth.context.qbConnectionId) {
    // A conversation without a company can't be listed back sensibly, and the
    // chat itself already refuses to run without this header.
    return Response.json({ error: "Missing X-QB-Id header." }, { status: 400 });
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return Response.json({ error: "Conversation is too large to save." }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const payload = (body ?? {}) as Record<string, unknown>;
  const conversationId = typeof payload.conversationId === "string" ? payload.conversationId : null;

  try {
    const conversation = await upsertConversation(auth.context.userId, {
      conversationId,
      qbConnectionId: auth.context.qbConnectionId,
      // Shape/length validation lives in the store's normaliseMessages — it is
      // the same gate for every writer.
      messages: payload.messages,
      now: Date.now(),
    });
    return Response.json({ conversation }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof ChatHistoryStoreError && error.message === "empty-conversation") {
      return Response.json({ error: "Nothing to save." }, { status: 400 });
    }
    return storeFailure(error, "save");
  }
}

/**
 * Storage problems are ours, not the caller's, and the message bodies involved
 * are financial data — log the operation and the error name only, never the
 * payload (same rule as /api/chat's structural-logging-only comment).
 */
function storeFailure(error: unknown, operation: string): Response {
  const name = error instanceof Error ? `${error.name}: ${error.message}` : "unknown";
  console.log(`[chat-history] ${operation} failed:`, name);
  return Response.json({ error: "Couldn't reach chat history. Please try again." }, { status: 503 });
}
