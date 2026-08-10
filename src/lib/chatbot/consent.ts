// SERVER-ONLY. Binds a human's confirmation to one exact operation.
//
// Two independent things must both be true before a destructive tool runs:
//
//   1. The HUMAN clicked confirm. Reported by the client as `userConfirmed`
//      on the request (see ChatPanel). The model cannot set this — it is not
//      part of any tool schema and never appears in model output.
//   2. The ARGUMENTS match the ones that were described when confirmation was
//      requested. Enforced by the ticket in this file.
//
// Why both: (1) alone was the deployed state, and it stopped the model from
// authorizing itself — but a confirmation for "deactivate Acme Corp" still
// authorized whatever the model passed next, and probing showed it happily
// resolved an ambiguous name to one of two near-identical vendors on its own.
// (2) alone is worse than useless: a ticket the model can mint on demand and
// replay is just `confirm: true` with extra steps.
//
// The HMAC key is derived from the caller's own access token, which makes a
// ticket implicitly user-bound (a different user derives a different key, so
// one user's ticket cannot verify for another) without introducing a new
// deployment secret — one less thing to get wrong per environment.
import { createHmac, timingSafeEqual } from "node:crypto";

/** Long enough for a human to read a dialog and click; short enough to bound replay. */
const TICKET_TTL_MS = 10 * 60_000;

const VERSION = "v1";

/**
 * Deterministic representation of a tool call. Recursive — sorting only the
 * top level would let a re-emitted `extractedData` with its keys in a
 * different order fail to match, turning a legitimate confirmation into a
 * dead end.
 */
function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    // The confirmation plumbing is not part of the operation's identity.
    .filter(([k]) => k !== "confirm" && k !== "confirmationToken")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(",")}}`;
}

function sign(secret: string, message: string): string {
  return createHmac("sha256", `savetrix-consent:${secret}`).update(message).digest("hex");
}

function fingerprint(toolName: string, args: Record<string, unknown>): string {
  return `${toolName} ${canonicalize(args)}`;
}

export interface MintedTicket {
  token: string;
}

/**
 * `requestId` is the id of the HTTP request doing the minting. Verification
 * REFUSES a ticket carrying the current request's id, which is what stops the
 * model from minting a ticket and spending it inside the same turn — the
 * failing call and the retry would share a request id. A ticket therefore
 * cannot be used until the turn ends, and the turn cannot end without the
 * user seeing the assistant's message.
 */
export function mintConsentTicket(
  toolName: string,
  args: Record<string, unknown>,
  accessToken: string,
  requestId: string,
): string {
  const issuedAt = Date.now();
  const body = `${VERSION}.${requestId}.${issuedAt}`;
  const mac = sign(accessToken, `${body} ${fingerprint(toolName, args)}`);
  return `${body}.${mac}`;
}

export type ConsentVerdict =
  | { ok: true }
  | { ok: false; reason: "missing" | "malformed" | "expired" | "same-request" | "mismatch" };

export function verifyConsentTicket(
  token: string | undefined,
  toolName: string,
  args: Record<string, unknown>,
  accessToken: string,
  requestId: string,
): ConsentVerdict {
  if (!token || typeof token !== "string") return { ok: false, reason: "missing" };

  const parts = token.split(".");
  if (parts.length !== 4) return { ok: false, reason: "malformed" };
  const [version, ticketRequestId, issuedAtRaw, mac] = parts;
  if (version !== VERSION) return { ok: false, reason: "malformed" };

  const issuedAt = Number(issuedAtRaw);
  if (!Number.isSafeInteger(issuedAt)) return { ok: false, reason: "malformed" };
  if (Date.now() - issuedAt > TICKET_TTL_MS) return { ok: false, reason: "expired" };
  // Clock skew / a ticket claiming the future is not something we mint.
  if (issuedAt - Date.now() > 60_000) return { ok: false, reason: "malformed" };

  if (ticketRequestId === requestId) return { ok: false, reason: "same-request" };

  const body = `${version}.${ticketRequestId}.${issuedAtRaw}`;
  const expected = sign(accessToken, `${body} ${fingerprint(toolName, args)}`);
  // Constant-time: the comparison is over attacker-influenced input, and a
  // plain === leaks how much of the digest matched.
  const a = Buffer.from(mac, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: "mismatch" };

  return { ok: true };
}

/**
 * Request-scoped record of operations already performed, so one confirmed
 * ticket cannot drive the same destructive write twice inside a single turn
 * (the model does sometimes repeat a call). Deliberately per-request rather
 * than module-level: module state would neither survive Vercel's instance
 * fan-out nor be safe to share between users.
 */
export class ConsumedOperations {
  private readonly seen = new Set<string>();

  /** Returns false if this exact operation was already consumed this request. */
  claim(toolName: string, args: Record<string, unknown>): boolean {
    const key = fingerprint(toolName, args);
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    return true;
  }
}

/** Exposed for tests only. */
export const __testing = { canonicalize, fingerprint };
