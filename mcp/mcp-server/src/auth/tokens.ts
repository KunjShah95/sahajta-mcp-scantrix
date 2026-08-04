import { createHash } from "node:crypto";
import { EncryptJWT, jwtDecrypt, type JWTPayload } from "jose";

// All OAuth artifacts (authorization codes, access tokens, registered client
// records, and the /authorize -> /login request handoff) are stateless: they
// are encrypted JWTs (dir + A256GCM). Only this server can read them, so the
// wrapped Savetrix session is never exposed to the MCP client. This is what
// lets the connector run on serverless (Vercel) with no session database.

export type TokenType =
  | "code"
  | "access"
  | "refresh"
  | "client"
  | "login_req"
  /** Short-lived ticket that lets a browser POST one invoice file to /upload. */
  | "upload";

const keyCache = new Map<string, Uint8Array>();

const deriveKey = (secret: string): Uint8Array => {
  let key = keyCache.get(secret);
  if (!key) {
    key = new Uint8Array(createHash("sha256").update(secret).digest());
    keyCache.set(secret, key);
  }
  return key;
};

export const encryptToken = async (
  secret: string,
  type: TokenType,
  payload: Record<string, unknown>,
  expiresInSeconds: number,
): Promise<string> => {
  const now = Math.floor(Date.now() / 1000);
  return new EncryptJWT({ ...payload, typ: type } satisfies JWTPayload)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt(now)
    .setExpirationTime(now + expiresInSeconds)
    .encrypt(deriveKey(secret));
};

export const decryptToken = async <T = Record<string, unknown>>(
  secret: string,
  type: TokenType,
  token: string,
): Promise<T> => {
  const { payload } = await jwtDecrypt(token, deriveKey(secret));
  if (payload.typ !== type) {
    throw new Error(`Unexpected token type: ${String(payload.typ)}`);
  }
  return payload as T;
};
