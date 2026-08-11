// Concurrency tests for the chat-history store, run against an in-memory blob
// store so they ALWAYS execute — the blob-backed suite in
// chatHistoryRoutes.test.ts skips itself without BLOB_READ_WRITE_TOKEN, and the
// bug these cover (two tabs saving at once wiping a whole conversation) is
// exactly the kind that only shows up under interleaving you cannot arrange
// against a live store.
//
// The fake implements ChatHistoryBlobIo — the same seam the real Vercel adapter
// sits behind — so what runs is the real read-modify-write loop, including its
// preconditions, retries, merge fallback and quarantine.
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  ChatHistoryBlobIo,
  ChatHistoryStoreError,
  ChatHistoryWriteConflictError,
  ChatHistoryWritePrecondition,
  __setChatHistoryBlobIoForTests,
  deleteConversation,
  getConversation,
  listConversations,
  upsertConversation,
} from "../lib/chatHistory/store";

const USER = "concurrency-test-user";

interface StoredBlob {
  text: string;
  etag: string;
}

interface Deferred {
  promise: Promise<void>;
  resolve: () => void;
}

function deferred(): Deferred {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

/** How the fake reports its etags — the real store is observed to do both. */
type EtagStyle = "strong" | "weak";

/**
 * An in-memory stand-in for the blob store, with the two properties that make
 * the real one hazardous: reads hand out an etag, and a write only lands if its
 * precondition still holds.
 *
 * `hold("read:2")` / `hold("write:1")` suspend the Nth operation of that kind so
 * a test can pin down an exact interleaving of two writers.
 */
class FakeBlobStore implements ChatHistoryBlobIo {
  readonly blobs = new Map<string, StoredBlob>();
  /** Fires immediately before a write, once, so a test can slip a writer in. */
  beforeWrite: (() => Promise<void> | void) | null = null;

  private version = 0;
  private readCalls = 0;
  private writeCalls = 0;
  private readonly holds = new Map<string, { arrived: Deferred; release: Deferred }>();

  constructor(private readonly etagStyle: EtagStyle = "strong") {}

  /** Suspend operation `key` (e.g. "write:1") until the returned gate is opened. */
  hold(key: string): { arrived: Promise<void>; release: () => void } {
    const gate = { arrived: deferred(), release: deferred() };
    this.holds.set(key, gate);
    return { arrived: gate.arrived.promise, release: gate.release.resolve };
  }

  /** Forget the seeding traffic so hold() keys count from the test's own writers. */
  resetCounters(): void {
    this.readCalls = 0;
    this.writeCalls = 0;
    this.beforeWrite = null;
  }

  private async waitForGate(key: string): Promise<void> {
    const gate = this.holds.get(key);
    if (!gate) return;
    this.holds.delete(key);
    gate.arrived.resolve();
    await gate.release.promise;
  }

  private nextEtag(): string {
    this.version += 1;
    const opaque = `"v${this.version}"`;
    return this.etagStyle === "weak" ? `W/${opaque}` : opaque;
  }

  async read(pathname: string): Promise<StoredBlob | null> {
    await this.waitForGate(`read:${(this.readCalls += 1)}`);
    const stored = this.blobs.get(pathname);
    return stored ? { ...stored } : null;
  }

  async write(pathname: string, text: string, precondition: ChatHistoryWritePrecondition): Promise<void> {
    await this.waitForGate(`write:${(this.writeCalls += 1)}`);

    const hook = this.beforeWrite;
    if (hook) {
      // One-shot: an interleaving hook must not fire again for the writes it
      // itself provokes, or the test would recurse.
      this.beforeWrite = null;
      await hook();
    }

    const current = this.blobs.get(pathname);
    if (precondition.kind === "create" && current) throw new ChatHistoryWriteConflictError();
    if (precondition.kind === "match") {
      // A weak validator can never satisfy If-Match. Modelling that is the whole
      // point: it is what made the production data loss invisible.
      if (precondition.etag.startsWith("W/")) throw new ChatHistoryWriteConflictError();
      if (!current || current.etag !== precondition.etag) throw new ChatHistoryWriteConflictError();
    }

    this.blobs.set(pathname, { text, etag: this.nextEtag() });
  }

  async remove(pathname: string): Promise<void> {
    this.blobs.delete(pathname);
  }

  private historyEntry(): [string, StoredBlob] {
    const entries = [...this.blobs.entries()].filter(([pathname]) => !pathname.startsWith(QUARANTINE));
    assert.equal(entries.length, 1, "expected exactly one history document");
    return entries[0];
  }

  documentPathname(): string {
    return this.historyEntry()[0];
  }

  rawDocument(): string {
    return this.historyEntry()[1].text;
  }

  storedIds(): string[] {
    const parsed: unknown = JSON.parse(this.rawDocument());
    const conversations = (parsed as { conversations: { id: string }[] }).conversations;
    return conversations.map((conversation) => conversation.id);
  }

  quarantined(): string[] {
    return [...this.blobs.entries()]
      .filter(([pathname]) => pathname.startsWith(QUARANTINE))
      .map(([, blob]) => blob.text);
  }
}

const QUARANTINE = "chat-history/v1/quarantine/";

const message = (id: string, content: string, role: "user" | "assistant" = "user") => ({ id, role, content });

const saveNew = (content: string, now: number, qbConnectionId = "qb-1") =>
  upsertConversation(USER, { qbConnectionId, messages: [message("m1", content)], now });

let fake: FakeBlobStore;

function install(etagStyle: EtagStyle): FakeBlobStore {
  fake = new FakeBlobStore(etagStyle);
  __setChatHistoryBlobIoForTests(fake);
  return fake;
}

describe("chat history store — concurrent writers", () => {
  beforeEach(() => {
    install("strong");
  });

  afterEach(() => {
    __setChatHistoryBlobIoForTests(null);
  });

  // ── The data-loss bug ─────────────────────────────────────────────────────

  it("does not delete a conversation another writer created between our read and our write", async () => {
    // Seed so the document exists and both writers get an etag for it.
    const seed = await saveNew("Seed conversation", 1_000);

    // Writer A lands while writer B is mid-write, so B's pending document
    // predates A's conversation entirely.
    const saved: string[] = [];
    fake.beforeWrite = async () => {
      saved.push((await saveNew("Writer A's brand new conversation", 2_000)).id);
    };

    const b = await saveNew("Writer B's brand new conversation", 3_000);

    assert.equal(saved.length, 1, "the interleaved writer should have saved");
    const ids = fake.storedIds();
    assert.ok(ids.includes(saved[0]), "writer A's conversation must survive writer B's write");
    assert.ok(ids.includes(b.id), "writer B's own conversation must be stored");
    assert.deepEqual([...ids].sort(), [seed.id, saved[0], b.id].sort());
  });

  it("does not lose messages another writer appended to the same conversation", async () => {
    const created = await saveNew("Shared conversation", 1_000);

    // Writer A appends an assistant turn while writer B is mid-save.
    fake.beforeWrite = async () => {
      await upsertConversation(USER, {
        conversationId: created.id,
        qbConnectionId: "qb-1",
        messages: [message("m1", "Shared conversation"), message("m2", "Answer from tab A", "assistant")],
        now: 2_000,
      });
    };

    // Writer B never saw m2 — it replays its own transcript instead.
    await upsertConversation(USER, {
      conversationId: created.id,
      qbConnectionId: "qb-1",
      messages: [message("m1", "Shared conversation"), message("m3", "Follow-up from tab B")],
      now: 3_000,
    });

    const conversation = await getConversation(USER, created.id);
    assert.ok(conversation);
    assert.deepEqual(
      conversation.messages.map((entry) => entry.id),
      ["m1", "m2", "m3"],
      "the union of both transcripts, in order, with no duplicates",
    );
    assert.equal(conversation.messageCount, 3);
  });

  it("keeps the newer version of a conversation both writers touched", async () => {
    const created = await saveNew("Original", 1_000);

    await upsertConversation(USER, {
      conversationId: created.id,
      qbConnectionId: "qb-2",
      messages: [message("m1", "Original"), message("m2", "later turn")],
      now: 5_000,
    });
    // An older write must not roll back updatedAt or the company the
    // conversation was held against, but must still contribute its messages.
    await upsertConversation(USER, {
      conversationId: created.id,
      qbConnectionId: "qb-1",
      messages: [message("m1", "Original"), message("m9", "earlier turn")],
      now: 2_000,
    });

    const conversation = await getConversation(USER, created.id);
    assert.ok(conversation);
    assert.equal(conversation.updatedAt, 5_000);
    assert.equal(conversation.qbConnectionId, "qb-2");
    assert.deepEqual(
      conversation.messages.map((entry) => entry.id),
      ["m1", "m9", "m2"],
      "oldest transcript first, then the newer one's additions",
    );
  });

  it("does not resurrect a conversation another writer deleted", async () => {
    const doomed = await saveNew("Delete me", 1_000);
    const keeper = await saveNew("Keep me", 1_100);

    // The save below read a document that still contained `doomed`; the delete
    // lands before its write.
    fake.beforeWrite = async () => {
      assert.equal(await deleteConversation(USER, doomed.id), true);
    };

    const fresh = await saveNew("Written after the delete", 2_000);

    const ids = (await listConversations(USER)).map((conversation) => conversation.id);
    assert.ok(!ids.includes(doomed.id), "a deleted conversation must not come back");
    assert.deepEqual([...ids].sort(), [keeper.id, fresh.id].sort());
  });

  it("does not drop a conversation created while a delete was in flight", async () => {
    const doomed = await saveNew("Delete me", 1_000);

    const saved: string[] = [];
    fake.beforeWrite = async () => {
      saved.push((await saveNew("Created during the delete", 2_000)).id);
    };

    assert.equal(await deleteConversation(USER, doomed.id), true);

    assert.equal(saved.length, 1, "the racing writer should have saved");
    assert.deepEqual(
      (await listConversations(USER)).map((conversation) => conversation.id),
      [saved[0]],
    );
  });

  // ── Conflicts are real, not swallowed ─────────────────────────────────────

  it("surfaces an error when the write retries are exhausted", async () => {
    await saveNew("Seed", 1_000);
    const pathname = fake.documentPathname();
    const before = fake.rawDocument();

    // Every attempt finds the document changed underneath it, forever — the
    // case the old code answered with an unconditional overwrite and HTTP 200.
    let churn = 0;
    const realWrite = fake.write.bind(fake);
    fake.write = async (target, text, precondition) => {
      if (precondition.kind === "match") {
        churn += 1;
        const current = fake.blobs.get(pathname);
        if (current) fake.blobs.set(pathname, { ...current, etag: `"churn-${churn}"` });
      }
      return realWrite(target, text, precondition);
    };

    await assert.rejects(
      () => saveNew("This save cannot land", 2_000),
      (error: unknown) => error instanceof ChatHistoryStoreError && error.message === "blob-write-conflict",
      "an unwinnable conflict must fail loudly instead of clobbering",
    );

    assert.ok(churn >= 3, "every attempt should have carried a precondition");
    assert.equal(fake.rawDocument(), before, "the document that was there is untouched");
  });

  it("does not silently keep only one of two conversations created at the same time", async () => {
    // No document exists yet, so both writers take the create-only path.
    const saved: string[] = [];
    fake.beforeWrite = async () => {
      saved.push((await saveNew("First writer", 1_000)).id);
    };

    const second = await saveNew("Second writer", 2_000);

    assert.equal(saved.length, 1);
    assert.deepEqual(
      (await listConversations(USER)).map((conversation) => conversation.id).sort(),
      [saved[0], second.id].sort(),
    );
  });

  // ── Weak etags: no usable precondition ────────────────────────────────────

  describe("when the store serves weak etags", () => {
    beforeEach(() => {
      install("weak");
    });

    it("still saves instead of failing every conditional write", async () => {
      // Regression guard for the live-store behaviour recorded in
      // chatHistoryRoutes.test.ts: once the document was big enough to get a
      // weak validator, every conditional write 412'd and saves stopped.
      for (let turn = 0; turn < 4; turn += 1) {
        assert.ok((await saveNew(`turn ${turn}`, 1_000 + turn)).id);
      }
      assert.equal((await listConversations(USER)).length, 4);
    });

    it("carries a concurrent writer's conversation forward instead of overwriting it", async () => {
      const seed = await saveNew("Seed conversation", 1_000);
      fake.resetCounters();

      // Interleaving, with no precondition available to either writer:
      //   B reads → A reads → A writes → B writes (clobbering A) → A reads back
      // A's read-back is what notices the clobber, so A must restore its own
      // conversation WITHOUT deleting B's.
      const bWrite = fake.hold("write:1");
      const aReadBack = fake.hold("read:3");

      const bSave = saveNew("Writer B", 3_000);
      await bWrite.arrived;

      const aSave = saveNew("Writer A", 2_000);
      await aReadBack.arrived;

      bWrite.release();
      const b = await bSave;

      aReadBack.release();
      const a = await aSave;

      const ids = fake.storedIds();
      assert.ok(ids.includes(a.id), "the clobbered writer must restore its conversation");
      assert.ok(ids.includes(b.id), "and must not delete the conversation that clobbered it");
      assert.deepEqual([...ids].sort(), [seed.id, a.id, b.id].sort());
    });

    it("reports a conflict rather than success when the merge passes never settle", async () => {
      await saveNew("Seed", 1_000);

      // Something else overwrites the document immediately after every write, so
      // the read-back never shows what we wrote.
      const realWrite = fake.write.bind(fake);
      let hijacked = 0;
      fake.write = async (pathname, text, precondition) => {
        await realWrite(pathname, text, precondition);
        hijacked += 1;
        fake.blobs.set(pathname, { text: `{"version":1,"conversations":[]}`, etag: `"other-${hijacked}"` });
      };

      await assert.rejects(
        () => saveNew("Never settles", 2_000),
        (error: unknown) => error instanceof ChatHistoryStoreError && error.message === "blob-write-conflict",
      );
    });
  });

  // ── Corrupt documents must not cost the user their history ─────────────────

  describe("structurally corrupt documents", () => {
    /** Replace the user's document with `text`, bypassing the store's API. */
    function poison(text: string): void {
      fake.blobs.set(fake.documentPathname(), { text, etag: '"poisoned"' });
    }

    it("keeps the conversations it can still read", async () => {
      const good = await saveNew("Readable conversation", 1_000);
      const intact = (JSON.parse(fake.rawDocument()) as { conversations: unknown[] }).conversations[0];
      poison(JSON.stringify({ version: 1, conversations: [intact, null, { title: "no id here" }, 42] }));

      assert.deepEqual(
        (await listConversations(USER)).map((conversation) => conversation.id),
        [good.id],
        "the intact conversation survives its broken neighbours",
      );
    });

    it("preserves the old bytes instead of wiping history when the document is unreadable", async () => {
      await saveNew("About to be corrupted", 1_000);
      poison('{"version":1,"conversations":"this is not an array"}');

      // A read can't show anything, but it must not destroy or rewrite anything.
      assert.deepEqual(await listConversations(USER), []);
      assert.equal(fake.quarantined().length, 0, "a read alone must not write anything");

      const saved = await saveNew("Written over the corruption", 2_000);

      const quarantined = fake.quarantined();
      assert.equal(quarantined.length, 1, "the unreadable bytes must be copied aside first");
      assert.match(quarantined[0], /this is not an array/);
      assert.deepEqual(fake.storedIds(), [saved.id]);
    });

    it("refuses the write when the corrupt bytes cannot be preserved", async () => {
      await saveNew("About to be corrupted", 1_000);
      poison("}{ not json at all");

      const realWrite = fake.write.bind(fake);
      fake.write = async (pathname, text, precondition) => {
        if (pathname.startsWith(QUARANTINE)) throw new ChatHistoryStoreError("blob-write-failed");
        return realWrite(pathname, text, precondition);
      };

      await assert.rejects(
        () => saveNew("Should not land", 2_000),
        (error: unknown) => error instanceof ChatHistoryStoreError,
        "history must not be replaced while the old bytes are still unpreserved",
      );

      assert.equal(fake.rawDocument(), "}{ not json at all", "the corrupt bytes are still there");
      assert.equal(fake.quarantined().length, 0);
    });

    it("quarantines the same corrupt document to one pathname, not one per read", async () => {
      const corrupt = '{"conversations":{"not":"an array"}}';
      await saveNew("About to be corrupted", 1_000);
      poison(corrupt);

      await saveNew("First save after corruption", 2_000);
      const afterFirst = fake.quarantined().length;
      // Re-poison with identical bytes; the quarantine name is content-derived.
      poison(corrupt);
      await saveNew("Second save after corruption", 3_000);

      assert.equal(afterFirst, 1);
      assert.equal(fake.quarantined().length, 1, "identical bytes reuse the same quarantine pathname");
    });
  });
});
