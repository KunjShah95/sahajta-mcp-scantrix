// SERVER-ONLY. The single door into the chat-history routes.
//
// Both route files call this first and use nothing but its output, so the
// authorization rule lives in one place: no verified user id, no response.
// Deliberately mirrors src/app/api/chat/route.ts's header contract (Bearer +
// X-QB-Id, both sent explicitly by the client because route handlers can't
// read the browser's localStorage — architecture doc §4.2).
import { resolveChatUser } from "./identity";

export interface HistoryRequestContext {
  /** Verified server-side. Never derived from the path, query, or body. */
  userId: string;
  /** Active QuickBooks company, used to scope the list. Not a security boundary. */
  qbConnectionId: string | null;
}

export type AuthorizeResult =
  | { ok: true; context: HistoryRequestContext }
  | { ok: false; response: Response };

export async function authorizeHistoryRequest(request: Request): Promise<AuthorizeResult> {
  const accessToken = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!accessToken) {
    return { ok: false, response: Response.json({ error: "Missing Authorization header." }, { status: 401 }) };
  }

  const outcome = await resolveChatUser(accessToken);

  if (outcome.kind === "unauthenticated") {
    // Same shape/status the client already handles for /api/chat, which trips
    // sessionEmitter's SESSION_EXPIRED and sends the user back to login.
    return { ok: false, response: Response.json({ error: "Session expired. Please sign in again." }, { status: 401 }) };
  }

  if (outcome.kind === "unavailable") {
    // Fail closed. We would rather show "history is unavailable" than key
    // somebody's conversations off an unverified id.
    console.log("[chat-history] identity unavailable:", outcome.reason);
    return {
      ok: false,
      response: Response.json({ error: "Chat history is temporarily unavailable." }, { status: 503 }),
    };
  }

  return {
    ok: true,
    context: {
      userId: outcome.userId,
      qbConnectionId: request.headers.get("x-qb-id")?.trim() || null,
    },
  };
}
