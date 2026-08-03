import { createHash } from "node:crypto";
import { EncryptJWT, jwtDecrypt } from "jose";
const keyCache = new Map();
const deriveKey = (secret) => {
    let key = keyCache.get(secret);
    if (!key) {
        key = new Uint8Array(createHash("sha256").update(secret).digest());
        keyCache.set(secret, key);
    }
    return key;
};
export const encryptToken = async (secret, type, payload, expiresInSeconds) => {
    const now = Math.floor(Date.now() / 1000);
    return new EncryptJWT({ ...payload, typ: type })
        .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
        .setIssuedAt(now)
        .setExpirationTime(now + expiresInSeconds)
        .encrypt(deriveKey(secret));
};
export const decryptToken = async (secret, type, token) => {
    const { payload } = await jwtDecrypt(token, deriveKey(secret));
    if (payload.typ !== type) {
        throw new Error(`Unexpected token type: ${String(payload.typ)}`);
    }
    return payload;
};
