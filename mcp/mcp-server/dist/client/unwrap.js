export class UpstreamPayloadError extends Error {
    kind;
    /** Verbatim text the backend sent, when it sent any. */
    upstreamMessage;
    httpStatus;
    constructor(kind, message, detail = {}) {
        super(message);
        this.name = "UpstreamPayloadError";
        this.kind = kind;
        this.upstreamMessage = detail.upstreamMessage;
        this.httpStatus = detail.httpStatus;
    }
    /**
     * Body a tool hands back for a failed call. Says success:false AND carries
     * the upstream text, so neither the client nor the model can mistake it for
     * data. Paired with isError:true at the tool layer (see tools/index.ts).
     */
    toResult() {
        return {
            success: false,
            failure: this.kind,
            message: this.message,
            upstreamMessage: this.upstreamMessage,
            httpStatus: this.httpStatus,
        };
    }
}
const asRecord = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : undefined;
/** Keys a Savetrix/Express error body puts its human-readable text under. */
const MESSAGE_KEYS = ["message", "error", "errorMessage", "detail", "reason"];
const textOf = (value) => {
    if (typeof value === "string" && value.trim() !== "")
        return value.trim();
    const nested = asRecord(value)?.message;
    if (typeof nested === "string" && nested.trim() !== "")
        return nested.trim();
    return undefined;
};
/** The message the backend sent, looked for on both the envelope and its data. */
const upstreamMessageOf = (...candidates) => {
    for (const rec of candidates) {
        if (!rec)
            continue;
        for (const key of MESSAGE_KEYS) {
            const found = textOf(rec[key]);
            if (found)
                return found;
        }
    }
    return undefined;
};
/**
 * True when the body explicitly says the operation did not succeed. Only
 * unambiguous markers are listed: "failed" is deliberately absent because it
 * is a legitimate value of an invoice's own postedStatus.
 */
const signalsFailure = (...candidates) => candidates.some((rec) => rec !== undefined &&
    (rec.success === false ||
        rec.ok === false ||
        rec.status === "error" ||
        textOf(rec.error) !== undefined));
/** A short, non-sensitive description of a body we could not interpret. */
const describe = (value) => {
    if (value === null || value === undefined)
        return "an empty body";
    if (Array.isArray(value))
        return "an array";
    if (typeof value !== "object")
        return `a ${typeof value} body`;
    const keys = Object.keys(value);
    if (keys.length === 0)
        return "an empty object";
    return `an object with keys: ${keys.slice(0, 8).join(", ")}${keys.length > 8 ? ", …" : ""}`;
};
/**
 * Throw if the response explicitly reports a failure. Exported so non-list
 * callers can apply the same rule.
 */
export const assertUpstreamOk = (res, what) => {
    const body = asRecord(res.data);
    const payload = asRecord(body?.data);
    if (!signalsFailure(body, payload))
        return;
    const message = upstreamMessageOf(body, payload);
    throw new UpstreamPayloadError("upstream_failure", message
        ? `Savetrix reported a failure for ${what}: ${message}`
        : `Savetrix reported a failure for ${what} (no message supplied). This is NOT an empty result.`, { upstreamMessage: message, httpStatus: res.status });
};
/**
 * Returns the first array found under data.data.<key> (or a bare array body).
 *
 * Throws UpstreamPayloadError rather than returning [] when the response
 * signals a failure or cannot be interpreted — an empty array is reserved for
 * a response that really did carry an empty list.
 *
 * @param what human-readable name of the thing being listed, used in errors.
 */
export const unwrapList = (res, keys, what = keys[0] ?? "list") => {
    assertUpstreamOk(res, what);
    const body = asRecord(res.data);
    const payload = body?.data ?? res.data;
    // A real list — possibly legitimately empty. This is the only success path.
    if (Array.isArray(payload))
        return payload;
    const rec = asRecord(payload);
    if (rec) {
        for (const key of keys) {
            if (Array.isArray(rec[key]))
                return rec[key];
        }
    }
    // An absent or empty payload with no failure signal: treat as a genuinely
    // empty list, not a malformed response. Erroring here would regress
    // first-run onboarding — a brand-new account with nothing in it is the most
    // likely producer of `{}` — and we have no way to confirm against the live
    // backend which shape it sends for "you have nothing yet". The bug this file
    // exists to fix (a 200 carrying `success:false` / a message being reported
    // as "you have no invoices") is caught above and still fails loudly; only
    // the genuinely ambiguous empty case is allowed through as empty.
    if (payload === null || payload === undefined)
        return [];
    if (rec && Object.keys(rec).length === 0)
        return [];
    const message = upstreamMessageOf(body, rec);
    if (message) {
        throw new UpstreamPayloadError("upstream_failure", `Savetrix returned a message instead of ${what}: ${message}`, { upstreamMessage: message, httpStatus: res.status });
    }
    throw new UpstreamPayloadError("unrecognized_response", `Could not interpret the Savetrix response for ${what}: expected ${keys
        .map((k) => `data.${k}`)
        .join(" or ")} to be an array, got ${describe(payload)}. ` +
        "Refusing to report this as an empty list.", { httpStatus: res.status });
};
/**
 * Returns the first object found under data.data.<key>, else the data
 * envelope itself. Same failure rules as unwrapList: an explicit failure or
 * an uninterpretable body throws instead of being handed to the model as if
 * it were the requested record.
 */
export const unwrapOne = (res, keys, what = keys[0] ?? "record") => {
    assertUpstreamOk(res, what);
    const body = asRecord(res.data);
    const payload = body?.data ?? res.data;
    const rec = asRecord(payload);
    if (rec) {
        for (const key of keys) {
            if (rec[key] !== undefined && rec[key] !== null)
                return rec[key];
        }
    }
    const message = upstreamMessageOf(body, rec);
    if (message) {
        throw new UpstreamPayloadError("upstream_failure", `Savetrix returned a message instead of the requested ${what}: ${message}`, { upstreamMessage: message, httpStatus: res.status });
    }
    // No named key, but a non-empty object: the endpoint returned the record
    // itself rather than wrapping it. That is a shape we understand.
    if (rec && Object.keys(rec).length > 0)
        return rec;
    throw new UpstreamPayloadError("unrecognized_response", `Could not interpret the Savetrix response for ${what}: expected ${keys
        .map((k) => `data.${k}`)
        .join(" or ")}, got ${describe(payload)}.`, { httpStatus: res.status });
};
export const getPagination = (res) => {
    return res.data?.data?.pagination;
};
