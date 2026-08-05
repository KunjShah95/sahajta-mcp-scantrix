// Single-conversation endpoint: read one back, or delete it.
//
// THIS is the route an attacker would poke at — "change the id in the URL and
// read someone else's chat". It can't work: the id is only ever looked up
// *inside the caller's own document* (store.ts keys the blob path off the
// verified user id), so an id belonging to another user is not found, and
// "not yours" and "doesn't exist" return the identical 404. No id-to-owner
// table is consulted, because there is no shared id space to consult.
export const runtime = "nodejs";
export const maxDuration = 30;

import { authorizeHistoryRequest } from "@/lib/chatHistory/apiAuth";
import { deleteConversation, getConversation } from "@/lib/chatHistory/store";

// params is a promise in Next 16 (see node_modules/next/dist/docs/01-app/
// 03-api-reference/03-file-conventions/route.md — changed in 15.0.0-RC).
type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  const auth = await authorizeHistoryRequest(request);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  try {
    const conversation = await getConversation(auth.context.userId, id);
    if (!conversation) return notFound();
    return Response.json({ conversation }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return storeFailure(error, "open");
  }
}

export async function DELETE(request: Request, context: Context) {
  const auth = await authorizeHistoryRequest(request);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  try {
    const deleted = await deleteConversation(auth.context.userId, id);
    if (!deleted) return notFound();
    return new Response(null, { status: 204 });
  } catch (error) {
    return storeFailure(error, "delete");
  }
}

const notFound = (): Response => Response.json({ error: "Conversation not found." }, { status: 404 });

function storeFailure(error: unknown, operation: string): Response {
  const name = error instanceof Error ? `${error.name}: ${error.message}` : "unknown";
  console.log(`[chat-history] ${operation} failed:`, name);
  return Response.json({ error: "Couldn't reach chat history. Please try again." }, { status: 503 });
}
