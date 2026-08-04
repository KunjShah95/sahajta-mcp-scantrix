import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SessionStore } from "../session.js";
test("SessionStore round-trips tokens and user through a file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "savetrix-session-"));
    const file = join(dir, "session.json");
    try {
        const store = new SessionStore(file);
        assert.equal(store.load().accessToken, undefined);
        await store.save({ accessToken: "at", refreshToken: "rt", user: { id: "u1" } });
        const reloaded = new SessionStore(file);
        assert.equal(reloaded.load().accessToken, "at");
        assert.equal(reloaded.load().refreshToken, "rt");
        assert.deepEqual(reloaded.load().user, { id: "u1" });
        await store.clear();
        assert.equal(new SessionStore(file).load().accessToken, undefined);
    }
    finally {
        await rm(dir, { recursive: true, force: true });
    }
});
test("SessionStore tolerates a missing or corrupt file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "savetrix-session-"));
    const missing = join(dir, "missing.json");
    const corrupt = join(dir, "corrupt.json");
    try {
        assert.deepEqual(new SessionStore(missing).load(), {});
        await import("node:fs/promises").then(({ writeFile }) => writeFile(corrupt, "{not json"));
        assert.deepEqual(new SessionStore(corrupt).load(), {});
    }
    finally {
        await rm(dir, { recursive: true, force: true });
    }
});
