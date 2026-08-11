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
//
// CONCURRENCY: because a save rewrites the whole document, two writers for the
// same user (two tabs, or a save racing a delete) can destroy each other's
// work — not just reorder messages, but drop an entire conversation the other
// writer had just created. Two independent defences below, in this order:
//   1. Every write carries a real precondition (see writeAttempt). A conflict
//      is detected and retried against a freshly read document, and when the
//      retries run out the caller gets an error instead of a silent clobber.
//   2. Every write is rebuilt from a FRESHLY READ document with only the
//      caller's delta applied (see mutateDocument / upsertConversation's
//      mergeConversations). So even on the one path where the store gives us no
//      usable precondition (weak etags — see WEAK VALIDATORS below), a
//      concurrent writer's conversations survive our write instead of being
//      overwritten by a stale snapshot.
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
/** Where an unreadable document is preserved before it is replaced. */
const QUARANTINE_PREFIX = "chat-history/v1/quarantine/";
const DOCUMENT_VERSION = 1 as const;

/** Conditional (precondition-carrying) write attempts before we give up. */
const WRITE_ATTEMPTS = 3;
/** Fresh-read + delta-merge passes on the no-usable-precondition path. */
const MERGE_ATTEMPTS = 3;
const WRITE_RETRY_DELAY_MS = 150;

/**
 * WEAK VALIDATORS. Blob serves a weak validator (`W/"…"`) for some responses,
 * and per RFC 7232 `If-Match` uses *strong* comparison, so a weak validator can
 * never satisfy it — the precondition fails however fresh the read was. That is
 * not a theory here: it is the regression covered by "keeps saving after the
 * document grows big enough to get a weak etag" in src/test/chatHistoryRoutes
 * .test.ts, observed against the live store as a document grew.
 *
 * The SDK does not help us decide: `put()` copies `options.ifMatch` verbatim
 * into the `x-if-match` header with no strong/weak inspection at all
 * (node_modules/@vercel/blob/dist/index.js:291-292 and
 * dist/chunk-CIIQSN42.js:859-885), and there is no other conditional-write
 * primitive — only `ifMatch` (overwrite-if-unchanged) and `allowOverwrite`
 * (create-only). So a weak etag means "no usable precondition".
 *
 * What we must NOT do — and what the previous version of this file did — is
 * silently drop the precondition and write the snapshot anyway: that is an
 * unconditional whole-document overwrite, i.e. guaranteed data loss for exactly
 * the heaviest users. Instead we fall back to writeWithMergeRepair, which keeps
 * the fresh-read + delta discipline and verifies the write landed.
 */
const isWeakEtag = (etag: string): boolean => etag.startsWith("W/");

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

/**
 * Raised by ChatHistoryBlobIo.write when its precondition was NOT met — i.e.
 * another writer changed the document first. Kept separate from the @vercel/blob
 * error classes so mutateDocument's concurrency logic is testable against an
 * in-memory store (see __setChatHistoryBlobIoForTests).
 */
export class ChatHistoryWriteConflictError extends Error {
  constructor(readonly cause?: unknown) {
    super("chat-history-write-conflict");
    this.name = "ChatHistoryWriteConflictError";
  }
}

// ==============================
// THE STORAGE SEAM
// ==============================

/**
 * What a write is allowed to assume about the document already in the store.
 *   - `match`  — overwrite only if the document is still the one we read.
 *   - `create` — write only if no document exists yet (the first-ever save;
 *                without this, two tabs both creating a user's first
 *                conversation would silently keep only one of them).
 *   - `none`   — unconditional. Only used where an overwrite is the intent:
 *                quarantine copies, and the weak-etag merge path.
 */
export type ChatHistoryWritePrecondition =
  | { kind: "match"; etag: string }
  | { kind: "create" }
  | { kind: "none" };

/**
 * The whole of this module's dependency on blob storage. Narrow on purpose: it
 * keeps Vercel-specific details (private access, cache bypass, which SDK error
 * means "precondition failed") in one adapter, and lets the concurrency tests
 * run against an in-memory implementation so they don't need store credentials.
 */
export interface ChatHistoryBlobIo {
  /** Resolves null when the pathname holds nothing. */
  read(pathname: string): Promise<{ text: string; etag: string } | null>;
  /** Throws ChatHistoryWriteConflictError when `precondition` is not met. */
  write(pathname: string, text: string, precondition: ChatHistoryWritePrecondition): Promise<void>;
  /** Idempotent — deleting something absent is not an error. */
  remove(pathname: string): Promise<void>;
}

function assertConfigured(): void {
  // Mirrors the SDK's own credential resolution: OIDC needs BOTH a token and a
  // store id (VERCEL_OIDC_TOKEN alone is not enough), otherwise it falls back
  // to BLOB_READ_WRITE_TOKEN. Both are injected automatically once the store is
  // connected to the project; locally, `vercel env pull` writes the latter into
  // .env.local. Checked up front so a misconfigured environment reports itself
  // instead of surfacing as an opaque failure on every call.
  const hasOidc = Boolean(process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID);
  if (!process.env.BLOB_READ_WRITE_TOKEN && !hasOidc) {
    throw new ChatHistoryStoreError("blob-store-not-configured");
  }
}

const vercelBlobIo: ChatHistoryBlobIo = {
  async read(pathname) {
    assertConfigured();
    try {
      // useCache: false is REQUIRED, not an optimisation. We overwrite the same
      // pathname on every save, and cached private reads can serve the previous
      // version for up to 60s — which would show a user a conversation list
      // that is missing the message they just sent, and (worse) would hand
      // mutateDocument a stale etag and a stale document to write back.
      const result = await get(pathname, { access: "private", useCache: false });
      if (!result || result.statusCode !== 200) return null;
      return { text: await new Response(result.stream).text(), etag: result.blob.etag };
    } catch (error) {
      if (error instanceof BlobNotFoundError) return null;
      if (error instanceof ChatHistoryStoreError) throw error;
      throw new ChatHistoryStoreError("blob-read-failed", error);
    }
  },

  async write(pathname, text, precondition) {
    assertConfigured();
    try {
      await put(pathname, text, {
        access: "private",
        contentType: "application/json",
        // Fixed pathname per user — a random suffix would orphan the previous
        // document on every save.
        addRandomSuffix: false,
        // `allowOverwrite: false` IS the create-only precondition; the SDK
        // rejects combining it with ifMatch (dist/chunk-CIIQSN42.js:874-877).
        allowOverwrite: precondition.kind !== "create",
        ...(precondition.kind === "match" ? { ifMatch: precondition.etag } : {}),
      });
    } catch (error) {
      if (error instanceof BlobPreconditionFailedError) throw new ChatHistoryWriteConflictError(error);
      // A rejected `allowOverwrite: false` does NOT come back as
      // BlobPreconditionFailedError — the API reports "blob already exists" as a
      // generic error code the SDK maps to BlobError/BlobUnknownError, and
      // matching on its message would be brittle. So decide by observation
      // instead: if a document is there now, we lost a create race.
      if (precondition.kind === "create" && (await pathnameExists(pathname))) {
        throw new ChatHistoryWriteConflictError(error);
      }
      throw new ChatHistoryStoreError("blob-write-failed", error);
    }
  },

  async remove(pathname) {
    assertConfigured();
    try {
      await del(pathname);
    } catch (error) {
      if (error instanceof BlobNotFoundError) return;
      if (error instanceof ChatHistoryStoreError) throw error;
      throw new ChatHistoryStoreError("blob-delete-failed", error);
    }
  },
};

/** Best-effort existence probe used only to classify a failed create. */
async function pathnameExists(pathname: string): Promise<boolean> {
  try {
    return (await vercelBlobIo.read(pathname)) !== null;
  } catch {
    return false;
  }
}

let blobIoOverride: ChatHistoryBlobIo | null = null;
const blobIo = (): ChatHistoryBlobIo => blobIoOverride ?? vercelBlobIo;

/** Test seam. Pass null to restore the real Vercel Blob adapter. */
export function __setChatHistoryBlobIoForTests(io: ChatHistoryBlobIo | null): void {
  blobIoOverride = io;
}

// ==============================
// READ / WRITE THE USER DOCUMENT
// ==============================

interface ReadResult {
  document: HistoryDocument;
  etag: string | null;
  /**
   * The raw bytes we could not fully make sense of, when reading them cost us
   * data. Non-null means "do not overwrite this until it has been preserved" —
   * see mutateDocument.
   */
  unsalvaged: string | null;
}

const readDocument = async (userId: string): Promise<ReadResult> =>
  parseDocument(await blobIo().read(documentPath(userId)));

function parseDocument(stored: { text: string; etag: string } | null): ReadResult {
  if (!stored) return { document: emptyDocument(), etag: null, unsalvaged: null };

  let parsed: unknown;
  try {
    parsed = JSON.parse(stored.text);
  } catch {
    return { document: emptyDocument(), etag: stored.etag, unsalvaged: stored.text };
  }

  const salvage = salvageConversations(parsed);
  return {
    document: { version: DOCUMENT_VERSION, conversations: salvage.conversations },
    etag: stored.etag,
    unsalvaged: salvage.lostData ? stored.text : null,
  };
}

/**
 * Pull every conversation we can still recognise out of whatever is stored.
 *
 * Previously an unreadable document was answered with an EMPTY document plus the
 * live etag, which meant the next save conditionally succeeded and erased the
 * user's entire history — a corrupt byte cost them everything. Now the parts we
 * can read are kept, and `lostData` tells the caller that replacing this
 * document would destroy something, so it gets copied aside first.
 */
function salvageConversations(parsed: unknown): { conversations: Conversation[]; lostData: boolean } {
  if (!parsed || typeof parsed !== "object") return { conversations: [], lostData: true };

  const candidates = (parsed as { conversations?: unknown }).conversations;
  if (!Array.isArray(candidates)) return { conversations: [], lostData: true };

  const conversations: Conversation[] = [];
  const seen = new Set<string>();
  let lostData = false;

  for (const candidate of candidates) {
    const salvaged = salvageConversation(candidate);
    if (!salvaged || seen.has(salvaged.conversation.id)) {
      lostData = true;
      continue;
    }
    if (salvaged.repaired) lostData = true;
    seen.add(salvaged.conversation.id);
    conversations.push(salvaged.conversation);
  }

  return { conversations, lostData };
}

function salvageConversation(candidate: unknown): { conversation: Conversation; repaired: boolean } | null {
  if (!candidate || typeof candidate !== "object") return null;
  const record = candidate as Record<string, unknown>;
  // Without an id a conversation can't be addressed, listed, or replaced.
  if (typeof record.id !== "string" || !record.id) return null;

  const messages = normaliseMessages(record.messages);
  const declared = Array.isArray(record.messages) ? record.messages.length : 0;
  const createdAt = finiteNumber(record.createdAt) ?? 0;

  return {
    conversation: storedConversation({
      id: record.id.slice(0, 128),
      title: typeof record.title === "string" && record.title ? record.title.slice(0, TITLE_MAX_CHARS) : buildTitle(messages),
      qbConnectionId: typeof record.qbConnectionId === "string" ? record.qbConnectionId : "",
      createdAt,
      updatedAt: finiteNumber(record.updatedAt) ?? createdAt,
      messages,
    }),
    // Only structural loss counts, so a harmless field difference (a future
    // version's extra key, say) can't put a user into a quarantine loop.
    repaired: !Array.isArray(record.messages) || messages.length !== declared,
  };
}

const finiteNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

/**
 * The one place a Conversation is assembled, so every document this module
 * writes serialises its keys in the same order. writeWithMergeRepair compares
 * serialised documents, and that comparison is only meaningful if the shape is
 * canonical.
 */
function storedConversation(input: Omit<Conversation, "messageCount">): Conversation {
  return {
    id: input.id,
    title: input.title,
    qbConnectionId: input.qbConnectionId,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    messageCount: input.messages.length,
    messages: input.messages,
  };
}

/**
 * Copy bytes we are about to replace but could not fully read to a sidecar
 * pathname, so a corrupt document is recoverable by hand instead of being
 * destroyed by the next save. The pathname is derived from the content, so
 * re-reading the same corrupt document re-writes the same blob rather than
 * accumulating copies.
 */
async function quarantineDocument(userId: string, raw: string): Promise<void> {
  const fingerprint = createHash("sha256").update(raw).digest("hex").slice(0, 16);
  const owner = createHash("sha256").update(userId).digest("hex");
  await blobIo().write(`${QUARANTINE_PREFIX}${owner}-${fingerprint}.json`, raw, { kind: "none" });
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Read → apply the caller's delta → write, re-reading and retrying when another
 * writer got there first.
 *
 * `apply` is handed the FRESHLY READ document on every attempt and must express
 * the change as a delta on top of it (add/replace/remove one conversation), not
 * as a whole-document snapshot it captured earlier. That is what stops a save
 * from deleting a conversation another tab created a moment ago.
 *
 * Unlike the previous version, the final attempt does NOT drop its precondition:
 * a write that cannot be made safely fails loudly (`blob-write-conflict`, which
 * the routes turn into a retryable 503) rather than clobbering the other writer
 * and reporting success.
 */
async function mutateDocument<T>(
  userId: string,
  apply: (document: HistoryDocument) => { document: HistoryDocument; result: T },
): Promise<T> {
  const pathname = documentPath(userId);
  let lastConflict: unknown;

  for (let attempt = 1; attempt <= WRITE_ATTEMPTS; attempt += 1) {
    const { document, etag, unsalvaged } = await readDocument(userId);
    // Never replace bytes we couldn't read until they're preserved. If this
    // throws, the save fails — which is the safe direction.
    if (unsalvaged !== null) await quarantineDocument(userId, unsalvaged);

    const { document: next, result } = apply(document);

    // No usable precondition (see WEAK VALIDATORS). Don't pretend otherwise.
    if (etag !== null && isWeakEtag(etag)) {
      return writeWithMergeRepair(userId, apply, { document: next, result });
    }

    try {
      await blobIo().write(
        pathname,
        JSON.stringify(next),
        etag === null ? { kind: "create" } : { kind: "match", etag },
      );
      return result;
    } catch (error) {
      if (!(error instanceof ChatHistoryWriteConflictError)) throw error;
      lastConflict = error;
      if (attempt < WRITE_ATTEMPTS) await delay(WRITE_RETRY_DELAY_MS * attempt);
    }
  }

  throw new ChatHistoryStoreError("blob-write-conflict", lastConflict);
}

/**
 * The fallback for documents whose etag can't be used as a precondition.
 *
 * Each pass writes a document built from the freshest read we have with only the
 * caller's delta applied, so a concurrent writer's conversations are carried
 * forward instead of being overwritten by a stale snapshot. Then it reads back:
 * if what's stored is no longer what we wrote, another writer landed after us
 * and may have dropped our change, so we fold our delta into THEIR version and
 * write again.
 *
 * HONEST LIMIT: without a precondition there is still a window — another writer
 * landing between our read and our write is invisible to us, and that writer's
 * delta is lost unless its own read-back catches it. What this buys is that the
 * loss is always *detectable by the writer that was clobbered*, and that both
 * writers converge on the union of their changes rather than one erasing the
 * other wholesale. Closing the window properly needs real mutual exclusion (the
 * only strong precondition Blob offers is create-only, so that would mean a lock
 * blob) — deliberately not attempted here.
 *
 * If it never settles we raise a conflict rather than claim success. Passes are
 * bounded, and each one is a full round trip, so this cannot spin hot.
 */
async function writeWithMergeRepair<T>(
  userId: string,
  apply: (document: HistoryDocument) => { document: HistoryDocument; result: T },
  first: { document: HistoryDocument; result: T },
): Promise<T> {
  const pathname = documentPath(userId);
  let pending = first;

  for (let pass = 1; pass <= MERGE_ATTEMPTS; pass += 1) {
    const written = JSON.stringify(pending.document);
    await blobIo().write(pathname, written, { kind: "none" });

    const readBack = await blobIo().read(pathname);
    if (!readBack || readBack.text === written) return pending.result;

    // Somebody wrote after us. Re-apply our delta on top of what they left —
    // reusing the bytes we just read back, so this costs no extra round trip.
    const { document, unsalvaged } = parseDocument(readBack);
    if (unsalvaged !== null) await quarantineDocument(userId, unsalvaged);
    pending = apply(document);
  }

  throw new ChatHistoryStoreError("blob-write-conflict");
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

/**
 * Fold two versions of the SAME conversation together. Called when the document
 * we just read already holds the conversation being saved — i.e. another writer
 * touched it since this client last synced.
 *
 * Whole-transcript replacement would silently discard whatever the other writer
 * added, so instead: the greater `updatedAt` wins the conversation's own fields,
 * and the messages are the union by id, in order, oldest transcript first. The
 * newer version wins on the body of a message both of them have (an assistant
 * turn that finished streaming, typically).
 */
function mergeConversations(a: Conversation, b: Conversation): Conversation {
  const [older, newer] = a.updatedAt <= b.updatedAt ? [a, b] : [b, a];

  const messages: StoredChatMessage[] = [];
  const positions = new Map<string, number>();
  for (const source of [older, newer]) {
    for (const message of source.messages) {
      const at = positions.get(message.id);
      if (at === undefined) {
        positions.set(message.id, messages.length);
        messages.push(message);
      } else if (source === newer) {
        messages[at] = message;
      }
    }
  }

  const capped = messages.slice(-MAX_MESSAGES_PER_CONVERSATION);
  return storedConversation({
    id: newer.id,
    title: buildTitle(capped),
    qbConnectionId: newer.qbConnectionId,
    createdAt: Math.min(older.createdAt, newer.createdAt),
    updatedAt: newer.updatedAt,
    messages: capped,
  });
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
    // `document` is always the newest one we can see; everything below is a
    // delta on top of it, never a snapshot captured before the call.
    const existing = input.conversationId
      ? document.conversations.find((conversation) => conversation.id === input.conversationId)
      : undefined;

    const incoming: Conversation = storedConversation({
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
      messages,
    });

    // Union with what's already stored rather than replacing it, so a turn the
    // other tab saved into this same conversation isn't dropped.
    const conversation = existing ? mergeConversations(existing, incoming) : incoming;

    const others = document.conversations.filter((candidate) => candidate.id !== conversation.id);
    return {
      document: { version: DOCUMENT_VERSION, conversations: applyCaps([conversation, ...others]) },
      result: toSummary(conversation),
    };
  });
}

export async function deleteConversation(userId: string, conversationId: string): Promise<boolean> {
  return mutateDocument(userId, (document) => {
    // Removal is expressed against the freshly read document, so this can
    // neither resurrect a conversation someone else deleted nor drop one they
    // just created.
    const remaining = document.conversations.filter((conversation) => conversation.id !== conversationId);
    return {
      document: { version: DOCUMENT_VERSION, conversations: remaining },
      result: remaining.length !== document.conversations.length,
    };
  });
}

/** Used by tests/tooling only — the app never wipes a user's whole history. */
export async function deleteAllConversations(userId: string): Promise<void> {
  await blobIo().remove(documentPath(userId));
}

function randomConversationId(): string {
  return `c-${globalThis.crypto.randomUUID()}`;
}
