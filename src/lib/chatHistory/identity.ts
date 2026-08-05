// SERVER-ONLY. Establishes *who is asking* for chat history, on the server,
// from nothing but the caller's Bearer token.
//
// This is the whole security story for the feature: every route handler keys
// storage off the id this module returns, and NEVER off anything in the
// request path, query string, or JSON body. A client can therefore ask for
// "conversation X" but can only ever be handed conversation X if it lives
// under its own verified id — there is no request shape that widens the
// lookup (see route.ts / [id]/route.ts).
//
// Why it's shaped like this: the Savetrix backend owns identity, and this repo
// holds no signing secret for its tokens (same constraint as
// src/app/api/chat/route.ts, which forwards the user's own credential rather
// than holding a service one). So we do not attempt to verify a signature
// locally — we ask the backend to vouch for the token, and only then read the
// subject out of it. Both steps are required:
//
//   1. VOUCHING  — call a backend endpoint that 401s on a bad token. A forged
//                  or expired token cannot survive this, because we are not
//                  the ones judging it.
//   2. SUBJECT   — take the user id from the vouched-for token's own payload
//                  (or straight from the profile response, when the backend
//                  gives us one). Since step 1 proved the backend issued this
//                  token, its payload is authentic: an attacker cannot mint a
//                  token carrying somebody else's subject.
//
// Decoding a JWT payload without checking its signature is only safe *because*
// of step 1. Never reorder these, and never keep the subject if vouching fails.
import { createHash } from "node:crypto";

// Same env var + fallback as src/lib/api.ts. Never hardcode a new URL inline.
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.savetrix.com/api";

const UPSTREAM_TIMEOUT_MS = 10_000;

/**
 * Verified identities are cached briefly, keyed by a hash of the token, so a
 * burst of history calls (list + open + save around one chat turn) costs one
 * upstream round trip instead of four. Short by design: it must not outlive a
 * logout or a token revocation by long. Per-instance and in-memory, exactly
 * like the rate-limit map in src/app/api/chat/route.ts — see architecture doc
 * §7.11 for why that's acceptable here and what a shared store would buy.
 */
const IDENTITY_CACHE_TTL_MS = 60_000;
const IDENTITY_CACHE_MAX_ENTRIES = 500;

export type IdentityOutcome =
  /** Token vouched for by the backend, and we know whose it is. */
  | { kind: "authenticated"; userId: string }
  /** Backend rejected the token — missing, expired, revoked, or forged. */
  | { kind: "unauthenticated" }
  /**
   * We could not establish identity — upstream unreachable, or it vouched for
   * the token but we could not determine a stable user id. Callers must fail
   * closed (503), never fall back to a shared or guessed bucket.
   */
  | { kind: "unavailable"; reason: string };

const identityCache = new Map<string, { expiresAt: number; outcome: IdentityOutcome }>();

const tokenKey = (accessToken: string): string =>
  createHash("sha256").update(accessToken).digest("hex");

function readCache(key: string): IdentityOutcome | null {
  const hit = identityCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    identityCache.delete(key);
    return null;
  }
  return hit.outcome;
}

function writeCache(key: string, outcome: IdentityOutcome): void {
  // Never cache "unavailable" — that's a transient upstream condition, and
  // caching it would keep the feature down after upstream recovers.
  if (outcome.kind === "unavailable") return;
  if (identityCache.size >= IDENTITY_CACHE_MAX_ENTRIES) {
    // Coarse eviction: drop the oldest insertion. Map preserves insertion
    // order, and this map only ever holds short-lived entries.
    const oldest = identityCache.keys().next();
    if (!oldest.done) identityCache.delete(oldest.value);
  }
  identityCache.set(key, { expiresAt: Date.now() + IDENTITY_CACHE_TTL_MS, outcome });
}

/**
 * Test-only. Drops the identity cache AND re-arms the `/users/me` probe below,
 * both of which are module-scoped on purpose (they're per-instance caches, not
 * request state) and would otherwise leak between test cases.
 */
export function __resetIdentityStateForTests(): void {
  identityCache.clear();
  profileEndpointUsable = true;
}

async function callUpstream(path: string, accessToken: string): Promise<Response | null> {
  try {
    return await fetch(`${BASE_URL}${path}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    // Network error / timeout. Structural only — never log the token.
    return null;
  }
}

/**
 * Pull a user id out of whatever shape the backend answers with. The API wraps
 * payloads as {success, message, data} (see the 401 bodies in src/lib/api.ts's
 * interceptor), and `data` may be the user itself or {user: {...}}, so probe
 * the shapes we know rather than assuming one.
 */
function pickUserId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const candidates: unknown[] = [];
  const record = payload as Record<string, unknown>;
  const data = record.data as Record<string, unknown> | undefined;
  const nested = data?.user as Record<string, unknown> | undefined;

  for (const source of [nested, data, record]) {
    if (!source || typeof source !== "object") continue;
    candidates.push(source._id, source.id, source.userId, source.uid);
  }

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}

/**
 * The subject claim of a JWT-shaped token, WITHOUT signature verification.
 * Only ever consumed after the backend has vouched for the token — see the
 * file header. Returns null for opaque (non-JWT) tokens, which is fine: the
 * caller then reports "unavailable" rather than inventing an id.
 */
function decodeJwtSubject(accessToken: string): string | null {
  const segments = accessToken.split(".");
  if (segments.length !== 3) return null;
  try {
    const json = Buffer.from(segments[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const payload: unknown = JSON.parse(json);
    const sub = (payload as Record<string, unknown> | null)?.sub;
    return pickUserId(payload) ?? (typeof sub === "string" && sub.trim() ? sub.trim() : null);
  } catch {
    return null;
  }
}

/**
 * `/users/me` is the ideal answer — it both vouches for the token and names
 * the user in one call. It isn't in this repo's ported client (which only ever
 * calls `/users/{id}`), so we can't assume it exists; module-scoped so one
 * 404/405 is enough to stop paying for the probe on this instance.
 */
let profileEndpointUsable = true;

export async function resolveChatUser(accessToken: string): Promise<IdentityOutcome> {
  const key = tokenKey(accessToken);
  const cached = readCache(key);
  if (cached) return cached;

  const outcome = await resolveUncached(accessToken);
  writeCache(key, outcome);
  return outcome;
}

async function resolveUncached(accessToken: string): Promise<IdentityOutcome> {
  let vouched = false;
  /** Only used when the token itself carries no subject — see below. */
  let reportedUserId: string | null = null;

  // ── Step 1: vouching ─────────────────────────────────────────────────────
  // Try the profile endpoint first: when it exists it both vouches for the
  // token and names the user, in one call.
  if (profileEndpointUsable) {
    const response = await callUpstream("/users/me", accessToken);
    if (response) {
      if (response.status === 401 || response.status === 403) return { kind: "unauthenticated" };
      if (response.ok) {
        vouched = true;
        reportedUserId = pickSelfUserId(await response.json().catch(() => null));
      } else if (response.status === 404 || response.status === 405) {
        profileEndpointUsable = false;
      }
    }
  }

  if (!vouched) {
    // /qb-connections is the app's own "am I signed in" call (every page load
    // hits it) and returns 401 for a missing/invalid token, verified against
    // the live API. A user with no QuickBooks company still gets a 2xx, so
    // this vouches for the session rather than for having connected
    // QuickBooks.
    const response = await callUpstream("/qb-connections", accessToken);
    if (!response) return { kind: "unavailable", reason: "upstream-unreachable" };
    if (response.status === 401 || response.status === 403) return { kind: "unauthenticated" };
    if (!response.ok) return { kind: "unavailable", reason: `upstream-${response.status}` };
    vouched = true;
  }

  // ── Step 2: subject ──────────────────────────────────────────────────────
  // The token's own subject is preferred over anything a response body says,
  // because it is per-user *by construction*: it came out of a credential the
  // backend minted for this one user and just vouched for. A response body is
  // only as trustworthy as our guess about its shape — and the failure mode
  // there is the dangerous one (mis-reading a shared field as an id would put
  // two users in the same bucket), so it's the fallback, not the primary.
  const userId = decodeJwtSubject(accessToken) ?? reportedUserId;
  if (!userId) return { kind: "unavailable", reason: "no-subject" };
  return { kind: "authenticated", userId };
}

/**
 * A user id from a profile response — but only if the payload really looks
 * like one user's record. Requiring an accompanying email means an unexpected
 * 200 (a catch-all handler, a collection response, an HTML error page rendered
 * as JSON) doesn't get mistaken for an identity that every caller would then
 * share.
 */
function pickSelfUserId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const data = record.data as Record<string, unknown> | undefined;
  const nested = data?.user as Record<string, unknown> | undefined;
  const self = [nested, data, record].find(
    (candidate) => candidate && typeof candidate === "object" && typeof candidate.email === "string",
  );
  return self ? pickUserId(self) : null;
}
