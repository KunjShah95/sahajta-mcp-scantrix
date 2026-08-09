import { createHmac } from "crypto";

/**
 * Server-minted consent tokens bind a human's confirmation to a specific
 * (tool, args) pair. This prevents the model from changing arguments after
 * a user clicks "yes" — e.g., after confirming "deactivate vendor X", the
 * model cannot resolve "vendor X" to a different record and use the same
 * token to execute against that one.
 *
 * Token format: base64(signature + timestamp), where signature is HMAC of
 * (toolName || canonicalizedArgs || timestamp) with a ephemeral per-request salt.
 */

const TOKEN_VALIDITY_MS = 60_000; // 1 minute — one tool roundtrip max

/**
 * Canonicalize tool args for hashing: deterministic JSON without whitespace.
 * Only includes fields that are NOT the confirmation itself.
 */
function canonicalizeArgs(toolName: string, args: Record<string, unknown>): string {
  const relevant = { ...args };
  delete relevant.confirm;
  delete relevant.confirmationToken;
  // Sort keys for deterministic output.
  const sorted = Object.keys(relevant)
    .sort()
    .reduce(
      (acc, key) => {
        acc[key] = relevant[key];
        return acc;
      },
      {} as Record<string, unknown>,
    );
  return `${toolName}:${JSON.stringify(sorted)}`;
}

/**
 * Mint a consent token for a specific tool + args. The token encodes:
 * - Which tool was called
 * - What arguments were provided (minus confirm flags)
 * - When it was issued
 *
 * The token is signed with a per-request salt, making it impossible to
 * forge or replay across requests.
 */
export function mintConsentToken(
  toolName: string,
  args: Record<string, unknown>,
  requestSalt: string,
): string {
  const now = Math.floor(Date.now() / 1000);
  const canonical = canonicalizeArgs(toolName, args);
  const message = `${canonical}:${now}`;
  const signature = createHmac("sha256", requestSalt).update(message).digest("hex").slice(0, 16);
  return Buffer.from(`${signature}:${now}`).toString("base64url");
}

/**
 * Verify a consent token matches the current tool + args. Returns true if
 * the token is valid and fresh (issued within TOKEN_VALIDITY_MS).
 */
export function verifyConsentToken(
  token: string,
  toolName: string,
  args: Record<string, unknown>,
  requestSalt: string,
): boolean {
  try {
    const decoded = Buffer.from(token, "base64url").toString();
    const [signature, timestampStr] = decoded.split(":");
    const timestamp = parseInt(timestampStr, 10);

    if (!Number.isInteger(timestamp)) return false;

    // Check freshness.
    const now = Math.floor(Date.now() / 1000);
    if (now - timestamp > TOKEN_VALIDITY_MS / 1000) return false;

    // Verify signature.
    const canonical = canonicalizeArgs(toolName, args);
    const message = `${canonical}:${timestamp}`;
    const expectedSignature = createHmac("sha256", requestSalt)
      .update(message)
      .digest("hex")
      .slice(0, 16);

    return signature === expectedSignature;
  } catch {
    return false;
  }
}
