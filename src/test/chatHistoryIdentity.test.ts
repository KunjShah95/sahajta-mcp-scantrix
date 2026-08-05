// Unit tests for the one thing the whole feature's security rests on: that a
// chat-history request's user id comes from a token the BACKEND vouched for,
// and never from an unverified token payload or anything client-supplied.
//
// Run with: npm test   (node --import tsx --test)
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { __resetIdentityStateForTests, resolveChatUser } from "../lib/chatHistory/identity";

const realFetch = globalThis.fetch;

/** A JWT-shaped token (unsigned — nothing here verifies signatures) with the given payload. */
function jwtWith(payload: Record<string, unknown>): string {
  const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}.signature-not-checked-here`;
}

interface StubbedCall {
  path: string;
  authorization: string | null;
}

/** Route stub keyed by the trailing path of the upstream URL. */
function stubUpstream(routes: Record<string, { status: number; body?: unknown }>): StubbedCall[] {
  const calls: StubbedCall[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const path = Object.keys(routes).find((candidate) => url.endsWith(candidate));
    calls.push({
      path: path ?? url,
      authorization: new Headers(init?.headers).get("authorization"),
    });
    const route = path ? routes[path] : undefined;
    if (!route) return new Response("not stubbed", { status: 500 });
    return new Response(route.body === undefined ? null : JSON.stringify(route.body), {
      status: route.status,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof globalThis.fetch;
  return calls;
}

describe("resolveChatUser", () => {
  beforeEach(() => __resetIdentityStateForTests());
  afterEach(() => {
    globalThis.fetch = realFetch;
    __resetIdentityStateForTests();
  });

  it("resolves in a single upstream call when the profile endpoint exists", async () => {
    const calls = stubUpstream({
      "/users/me": { status: 200, body: { success: true, data: { user: { _id: "user-alice", email: "a@x.com" } } } },
    });

    const outcome = await resolveChatUser(jwtWith({ sub: "user-alice" }));

    assert.deepEqual(outcome, { kind: "authenticated", userId: "user-alice" });
    assert.equal(calls.length, 1, "should not need a second upstream call");
    assert.equal(calls[0].authorization, `Bearer ${jwtWith({ sub: "user-alice" })}`);
  });

  it("falls back to vouch-then-read-subject when there is no profile endpoint", async () => {
    const calls = stubUpstream({
      "/users/me": { status: 404 },
      "/qb-connections": { status: 200, body: { success: true, data: [] } },
    });

    const outcome = await resolveChatUser(jwtWith({ _id: "user-bob" }));

    assert.deepEqual(outcome, { kind: "authenticated", userId: "user-bob" });
    assert.deepEqual(
      calls.map((call) => call.path),
      ["/users/me", "/qb-connections"],
    );
  });

  it("treats a token the backend rejects as unauthenticated, even though it carries a subject", async () => {
    // This is the forgery case: anyone can hand-write a JWT payload naming
    // another user. Identity must come from the backend's verdict, not the
    // payload — so a rejected token yields no user id at all.
    stubUpstream({
      "/users/me": { status: 404 },
      "/qb-connections": { status: 401, body: { message: "Invalid access token" } },
    });

    const outcome = await resolveChatUser(jwtWith({ sub: "user-victim" }));

    assert.deepEqual(outcome, { kind: "unauthenticated" });
  });

  it("rejects when the profile endpoint itself says the token is invalid", async () => {
    stubUpstream({ "/users/me": { status: 401, body: { message: "Invalid access token" } } });

    assert.deepEqual(await resolveChatUser("expired-token"), { kind: "unauthenticated" });
  });

  it("uses the id the backend reports when the token carries no subject", async () => {
    stubUpstream({
      "/users/me": { status: 200, body: { data: { _id: "user-carol", email: "carol@x.com" } } },
    });

    // Opaque token: nothing to read a subject out of, so the profile response
    // is the only source left.
    const outcome = await resolveChatUser("opaque-session-token");

    assert.deepEqual(outcome, { kind: "authenticated", userId: "user-carol" });
  });

  it("ignores a 200 that doesn't look like one user's record", async () => {
    // An unexpected 200 (catch-all route, collection response, error page) must
    // not be mined for an id — that id would be identical for every caller,
    // i.e. one shared history bucket. No email alongside the id, no identity.
    stubUpstream({
      "/users/me": { status: 200, body: { data: [{ _id: "not-a-single-user" }] } },
      "/qb-connections": { status: 200, body: { data: [] } },
    });

    const outcome = await resolveChatUser("opaque-session-token");

    assert.equal(outcome.kind, "unavailable");
  });

  it("prefers the vouched-for token's own subject over anything a body reports", async () => {
    stubUpstream({
      "/users/me": { status: 200, body: { data: { _id: "id-from-body", email: "someone@x.com" } } },
    });

    const outcome = await resolveChatUser(jwtWith({ sub: "id-from-token" }));

    assert.deepEqual(outcome, { kind: "authenticated", userId: "id-from-token" });
  });

  it("fails closed when the token is vouched for but yields no usable subject", async () => {
    // Opaque (non-JWT) token and no profile endpoint: we know the session is
    // real but not whose it is. Returning any id here would be a guess, and a
    // guess shared between users is exactly the bug we must not ship.
    stubUpstream({
      "/users/me": { status: 404 },
      "/qb-connections": { status: 200, body: { success: true, data: [] } },
    });

    const outcome = await resolveChatUser("opaque-session-token");

    assert.equal(outcome.kind, "unavailable");
  });

  it("fails closed when the backend is unreachable", async () => {
    globalThis.fetch = (async () => {
      throw new Error("ECONNREFUSED");
    }) as typeof globalThis.fetch;

    const outcome = await resolveChatUser(jwtWith({ sub: "user-alice" }));

    assert.equal(outcome.kind, "unavailable");
  });

  it("never hands one token's identity to a different token", async () => {
    stubUpstream({
      "/users/me": { status: 200, body: { data: { _id: "user-alice" } } },
    });
    const alice = await resolveChatUser(jwtWith({ sub: "user-alice" }));

    // Same instance, warm cache, different token -> the stub now answers as Bob.
    stubUpstream({
      "/users/me": { status: 200, body: { data: { _id: "user-bob" } } },
    });
    const bob = await resolveChatUser(jwtWith({ sub: "user-bob" }));

    assert.deepEqual(alice, { kind: "authenticated", userId: "user-alice" });
    assert.deepEqual(bob, { kind: "authenticated", userId: "user-bob" });
  });

  it("caches a verified identity instead of re-asking upstream per request", async () => {
    const calls = stubUpstream({
      "/users/me": { status: 200, body: { data: { _id: "user-alice" } } },
    });
    const token = jwtWith({ sub: "user-alice" });

    await resolveChatUser(token);
    await resolveChatUser(token);
    await resolveChatUser(token);

    assert.equal(calls.length, 1);
  });
});
