// SERVER-ONLY. Durable per-user chat-history storage on Vercel Blob.
//
// Why a server-side store at all: history has to survive a browser wipe, a new
// device, and a fresh sign-in, and — more importantly — the "only your own
// conversations" rule has to be enforced somewhere the user cannot edit. A
// browser-local store (localStorage/IndexedDB) can do neither: it is per-device
// and every filter in it runs on the attacker's own machine.
//
// Why Vercel Blob specifically: this app had no datastore of any kind (the MCP
// connector is deliberately stateless — see mcp/mcp-server/src/auth/tokens.ts),
// and Blob is the one durable store that needs no new marketplace account. The
// store is created with `--access private`, so blobs are not readable by URL;
// every read goes through `get(..., { access: "private" })` inside a route
// handler that has already verified who is asking.
//
// LAYOUT: one JSON document per user, at chat-history/v1/<sha256(userId)>.json.
//   - The path is derived from the verified user id, never from request input,
//     so "read another user's history" has no expressible request shape.
//   - Hashing keeps user ids (and, for email-shaped ids, PII) out of blob
//     pathnames, which appear in store listings and logs.
//   - One document per user means listing history is a single read, and a save
//     is a single write. It also makes the per-user caps below trivially
//     enforceable. The tradeoff is whole-document rewrites; at 50 conversations
//     that is well within Blob's comfort zone.
import { createHash } from "node:crypto";

import { BlobNotFoundError, BlobPreconditionFailedError, del, get, put } from "@vercel/blob";

import {
  Conversation,
  ConversationSummary,
  MAX_CONVERSATIONS_PER_USER,
  MAX_DOCUMENT_BYTES,
  MAX_MESSAGES_PER_CONVERSATION,
  MAX_MESSAGE_CHARS,
  StoredChatMessage,
} from "./types";

const PATH_PREFIX = "chat-history/v1/";
const DOCUMENT_VERSION = 1 as const;

/**
 * Two writers for the same user (two tabs, or a save racing a delete) would
 * otherwise silently clobber each other, since a save rewrites the whole
 * document. Blob's `ifMatch` turns that into a detectable conflict we retry.
 *
 * The last attempt deliberately drops the precondition — see mutateDocument.
 */
const WRITE_ATTEMPTS = 3;
const WRITE_RETRY_DELAY_MS = 150;

/**
 * Blob serves a WEAK validator (`W/"…"`) for some responses, and a weak etag
 * can never satisfy an `If-Match` — the precondition fails every time, however
 * fresh the read was (verified against the live store: a document crosses into
 * weak-etag territory as it grows, after which every conditional write 412s).
 * So a weak etag means "no usable precondition", not "conflict".
 */
const isStrongEtag = (etag: string | null): boolean => Boolean(etag) && !etag!.startsWith("W/");

interface HistoryDocument {
  version: typeof DOCUMENT_VERSION;
  conversations: Conversation[];
}

const emptyDocument = (): HistoryDocument => ({ version: DOCUMENT_VERSION, conversations: [] });

const documentPath = (userId: string): string =>
  `${PATH_PREFIX}${createHash("sha256").update(userId).digest("hex")}.json`;

/** Thrown when the store itself is misconfigured/unreachable; routes map it to 503. */
export class ChatHistoryStoreError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "ChatHistoryStoreError";
  }
}

function assertConfigured(): void {
  // On Vercel the SDK authenticates via the project's OIDC token; locally it
  // needs BLOB_READ_WRITE_TOKEN (written into .env.local by
  // `vercel blob create-store … --environment development`). Fail loudly and
  // early rather than letting every call turn into an opaque 500.
  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.VERCEL_OIDC_TOKEN && !process.env.BLOB_STORE_ID) {
    throw new ChatHistoryStoreError("blob-store-not-configured");
  }
}

// ==============================
// READ / WRITE THE USER DOCUMENT
// ==============================

async function readDocument(userId: string): Promise<{ document: HistoryDocument; etag: string | null }> {
  assertConfigured();
  try {
    // useCache: false is REQUIRED, not an optimisation. We overwrite the same
    // pathname on every save, and cached private reads can serve the previous
    // version for up to 60s — which would show a user a conversation list that
    // is missing the message they just sent.
    const result = await get(documentPath(userId), { access: "private", useCache: false });
    if (!result || result.statusCode !== 200) return { document: emptyDocument(), etag: null };

    const raw: unknown = JSON.parse(await new Response(result.stream).text());
    if (!raw || typeof raw !== "object" || !Array.isArray((raw as HistoryDocument).conversations)) {
      // Corrupt/foreign document: start clean rather than 500 forever. The
      // next save overwrites it.
      return { document: emptyDocument(), etag: result.blob.etag };
    }
    return {
      document: { version: DOCUMENT_VERSION, conversations: (raw as HistoryDocument).conversations },
      etag: result.blob.etag,
    };
  } catch (error) {
    if (error instanceof BlobNotFoundError) return { document: emptyDocument(), etag: null };
    if (error instanceof ChatHistoryStoreError) throw error;
    throw new ChatHistoryStoreError("blob-read-failed", error);
  }
}

async function writeDocument(userId: string, document: HistoryDocument, etag: string | null): Promise<void> {
  try {
    await put(documentPath(userId), JSON.stringify(document), {
      access: "private",
      contentType: "application/json",
      // Fixed pathname per user — a random suffix would orphan the previous
      // document on every save.
      addRandomSuffix: false,
      allowOverwrite: true,
      ...(isStrongEtag(etag) ? { ifMatch: etag! } : {}),
    });
  } catch (error) {
    if (error instanceof BlobPreconditionFailedError) throw error;
    throw new ChatHistoryStoreError("blob-write-failed", error);
  }
}

/**
 * Read → mutate → write, re-reading and retrying when another writer got there
 * first.
 *
 * The final attempt intentionally writes WITHOUT the precondition. Optimistic
 * concurrency is a nicety here — the realistic conflict is one person's two
 * tabs, where either transcript is a reasonable outcome — whereas refusing the
 * write means the message the user just sent is missing from their history. So
 * we prefer last-write-wins over data loss, and only after re-reading the
 * newest document we can see.
 */
async function mutateDocument<T>(
  userId: string,
  mutate: (document: HistoryDocument) => { document: HistoryDocument; result: T },
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    const { document, etag } = await readDocument(userId);
    const { document: next, result } = mutate(document);
    const lastAttempt = attempt >= WRITE_ATTEMPTS;
    try {
      await writeDocument(userId, next, lastAttempt ? null : etag);
      return result;
    } catch (error) {
      if (error instanceof BlobPreconditionFailedError && !lastAttempt) {
        await new Promise((resolve) => setTimeout(resolve, WRITE_RETRY_DELAY_MS * attempt));
        continue;
      }
      if (error instanceof BlobPreconditionFailedError) {
        throw new ChatHistoryStoreError("blob-write-conflict", error);
      }
      throw error;
    }
  }
}

// ==============================
// NORMALISATION (never trust the payload)
// ==============================

/**
 * The client sends whatever it likes; this is the only gate. Anything not
 * matching the wire shape is dropped rather than stored, so a poisoned
 * document can't come back out and break rendering — and message bodies are
 * length-capped so one caller can't fill a user's document (or the store).
 */
export function normaliseMessages(input: unknown): StoredChatMessage[] {
  if (!Array.isArray(input)) return [];
  const messages: StoredChatMessage[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const { id, role, content } = item as Record<string, unknown>;
    if (role !== "user" && role !== "assistant") continue;
    if (typeof content !== "string") continue;
    const trimmed = content.slice(0, MAX_MESSAGE_CHARS);
    if (!trimmed) continue;
    messages.push({
      id: typeof id === "string" && id ? id.slice(0, 128) : `m-${messages.length}`,
      role,
      content: trimmed,
    });
  }
  // Keep the most recent turns when a conversation runs long — the tail is
  // what the user is reading and what /api/chat replays as context.
  return messages.slice(-MAX_MESSAGES_PER_CONVERSATION);
}

const TITLE_MAX_CHARS = 80;

export function buildTitle(messages: StoredChatMessage[]): string {
  const first = messages.find((message) => message.role === "user");
  if (!first) return "New conversation";
  const flat = first.content.replace(/\s+/g, " ").trim();
  if (!flat) return "New conversation";
  return flat.length > TITLE_MAX_CHARS ? `${flat.slice(0, TITLE_MAX_CHARS - 1)}…` : flat;
}

const toSummary = (conversation: Conversation): ConversationSummary => ({
  id: conversation.id,
  title: conversation.title,
  qbConnectionId: conversation.qbConnectionId,
  createdAt: conversation.createdAt,
  updatedAt: conversation.updatedAt,
  messageCount: conversation.messages.length,
});

/**
 * Enforce the per-user ceilings, newest first. Dropping the oldest
 * conversations is the only bounded option: an unbounded document would grow
 * until reads time out, and silently failing to save the *newest* turn is the
 * worse failure for the person typing.
 */
function applyCaps(conversations: Conversation[]): Conversation[] {
  const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);
  let capped = sorted.slice(0, MAX_CONVERSATIONS_PER_USER);
  while (capped.length > 1 && JSON.stringify(capped).length > MAX_DOCUMENT_BYTES) {
    capped = capped.slice(0, -1);
  }
  return capped;
}

// ==============================
// PUBLIC API — every entry point takes a VERIFIED userId
// ==============================

export async function listConversations(userId: string, qbConnectionId?: string): Promise<ConversationSummary[]> {
  const { document } = await readDocument(userId);
  return document.conversations
    .filter((conversation) => !qbConnectionId || conversation.qbConnectionId === qbConnectionId)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(toSummary);
}

/**
 * Returns null — not an error — when the id doesn't exist *in this user's
 * document*. Callers turn that into a 404, so probing another user's
 * conversation id is indistinguishable from probing one that never existed.
 */
export async function getConversation(userId: string, conversationId: string): Promise<Conversation | null> {
  const { document } = await readDocument(userId);
  return document.conversations.find((conversation) => conversation.id === conversationId) ?? null;
}

export async function upsertConversation(
  userId: string,
  input: { conversationId?: string | null; qbConnectionId: string; messages: unknown; now: number },
): Promise<ConversationSummary> {
  const messages = normaliseMessages(input.messages);
  if (messages.length === 0) throw new ChatHistoryStoreError("empty-conversation");

  return mutateDocument(userId, (document) => {
    const existing = input.conversationId
      ? document.conversations.find((conversation) => conversation.id === input.conversationId)
      : undefined;

    const conversation: Conversation = {
      // A client-supplied id is only ever used to address a conversation
      // ALREADY in this user's document; otherwise the server mints one. That
      // keeps ids unguessable-by-construction and stops a client from writing
      // into an id it doesn't own (there is no shared id space to collide in,
      // but the invariant is cheap to keep).
      id: existing?.id ?? randomConversationId(),
      title: buildTitle(messages),
      qbConnectionId: input.qbConnectionId,
      createdAt: existing?.createdAt ?? input.now,
      updatedAt: input.now,
      messageCount: messages.length,
      messages,
    };

    const others = document.conversations.filter((candidate) => candidate.id !== conversation.id);
    return {
      document: { version: DOCUMENT_VERSION, conversations: applyCaps([conversation, ...others]) },
      result: toSummary(conversation),
    };
  });
}

export async function deleteConversation(userId: string, conversationId: string): Promise<boolean> {
  return mutateDocument(userId, (document) => {
    const remaining = document.conversations.filter((conversation) => conversation.id !== conversationId);
    return {
      document: { version: DOCUMENT_VERSION, conversations: remaining },
      result: remaining.length !== document.conversations.length,
    };
  });
}

/** Used by tests/tooling only — the app never wipes a user's whole history. */
export async function deleteAllConversations(userId: string): Promise<void> {
  assertConfigured();
  try {
    await del(documentPath(userId));
  } catch (error) {
    if (error instanceof BlobNotFoundError) return;
    throw new ChatHistoryStoreError("blob-delete-failed", error);
  }
}

function randomConversationId(): string {
  return `c-${globalThis.crypto.randomUUID()}`;
}
