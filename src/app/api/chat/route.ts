// The only OpenAI touchpoint in this app, and the first backend route this
// repo has ever had — see architecture doc §3/§4/§5. Every retrieval tool
// call forwards the REQUESTING USER'S OWN Bearer + X-QB-Id headers to the
// Savetrix backend; there is no separate/service credential, so the
// backend's existing per-company authorization is what scopes every answer.
//
// Uses the official `openai` Node SDK, which needs the Node runtime (not
// Edge) — see architecture doc §4.6.
export const runtime = "nodejs";
// Vercel plan's exact function-duration ceiling wasn't confirmed against the
// dashboard (see architecture doc §4.6 — "confirm rather than assume").
// 60s comfortably covers a multi-tool-call turn on today's usage; revisit if
// tool calls start timing out in production.
export const maxDuration = 60;

import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { RunnableToolFunctionWithParse } from "openai/lib/RunnableFunction";

import { chatToolSchemas } from "@/lib/chatbot/toolSchemas";
import { buildSystemPrompt, CHAT_MODEL } from "@/lib/chatbot/systemPrompt";
import { callTool, TOOL_NAMES } from "@/lib/chatbot/tools";

const MAX_HISTORY_MESSAGES = 20;
const MAX_OUTPUT_TOKENS = 1000;
const MAX_TOOL_ROUNDTRIPS = 6;

interface ChatRequestMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequestBody {
  message: string;
  history?: ChatRequestMessage[];
  companyName?: string;
}

// Best-effort, single-instance-only rate limit — see architecture doc §7.11.
// This does NOT hold across serverless instances/regions; it only bounds
// abuse that lands repeatedly on the same warm instance. A real per-user
// cap needs a shared store (e.g. Redis) and is called out as an open
// question (§9) for whoever owns the rate-limit budget.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const requestTimestamps = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const timestamps = (requestTimestamps.get(key) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  timestamps.push(now);
  requestTimestamps.set(key, timestamps);
  return timestamps.length > RATE_LIMIT_MAX_REQUESTS;
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  // Reject if the Bearer token is missing — this must be sent explicitly by
  // the client on every request. Route Handlers run server-side and have no
  // access to the browser's localStorage, so there's no accessToken to read
  // here even if we wanted to (architecture doc §4.2).
  if (!accessToken) {
    return Response.json({ error: "Missing Authorization header." }, { status: 401 });
  }

  const qbConnectionId = request.headers.get("x-qb-id")?.trim();
  // A missing QB connection means "user hasn't connected QuickBooks yet" —
  // every retrieval tool needs this header (architecture doc §4.2).
  if (!qbConnectionId) {
    return Response.json({ error: "Missing X-QB-Id header. Connect QuickBooks first." }, { status: 400 });
  }

  if (isRateLimited(accessToken)) {
    return Response.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: "Chat is not configured on this server." }, { status: 500 });
  }

  let body: ChatRequestBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body?.message || typeof body.message !== "string") {
    return Response.json({ error: "Missing message." }, { status: 400 });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const history = Array.isArray(body.history) ? body.history.slice(-MAX_HISTORY_MESSAGES) : [];
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: buildSystemPrompt(body.companyName) },
    ...history.map((m): ChatCompletionMessageParam => ({ role: m.role, content: m.content })),
    { role: "user", content: body.message },
  ];

  // Every tool call closes over THIS request's accessToken/qbConnectionId —
  // never a shared/service credential (architecture doc §5, §7.3).
  const tools: RunnableToolFunctionWithParse<Record<string, unknown>, unknown>[] = chatToolSchemas.map((tool) => ({
    type: "function",
    function: {
      name: tool.function.name,
      description: tool.function.description ?? "",
      parameters: tool.function.parameters ?? {},
      parse: (input: string) => {
        try {
          return JSON.parse(input);
        } catch {
          return {};
        }
      },
      function: (args: Record<string, unknown>) => {
        if (!TOOL_NAMES.includes(tool.function.name as (typeof TOOL_NAMES)[number])) {
          return { error: `Unknown tool: ${tool.function.name}` };
        }
        return callTool(tool.function.name, args, accessToken, qbConnectionId);
      },
    },
  }));

  const runner = openai.chat.completions.runTools(
    {
      model: CHAT_MODEL,
      max_completion_tokens: MAX_OUTPUT_TOKENS,
      messages,
      stream: true,
      tools,
    },
    { maxChatCompletions: MAX_TOOL_ROUNDTRIPS },
  );

  const encoder = new TextEncoder();
  let streamErrored = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // A tool-calling turn runs multiple completion rounds (see route's
      // MAX_TOOL_ROUNDTRIPS), and a round can emit visible text alongside a
      // tool call — e.g. round 2 asks the user something in text while also
      // deciding to make another (often redundant) call. Streaming every
      // round's text live means the user sees that superseded text AND the
      // eventual real answer restating the same thing — a visible
      // duplicate. Round 1 streams live as before (the common case: a plain
      // answer, or a silent tool call with no text). Once any round in this
      // turn has produced a tool call, later rounds' text is buffered
      // instead of streamed live, and only flushed once a round turns out to
      // be the final one (no tool_calls) — a round that also calls a tool
      // gets its buffered text discarded, never shown.
      let sawToolCall = false;
      let roundBuffer = "";

      runner.on("content", (delta) => {
        if (sawToolCall) {
          roundBuffer += delta;
        } else {
          controller.enqueue(encoder.encode(delta));
        }
      });
      runner.on("message", (message) => {
        if (message.role !== "assistant") return;
        if (message.tool_calls?.length) {
          sawToolCall = true;
          roundBuffer = "";
          return;
        }
        if (sawToolCall && roundBuffer) {
          controller.enqueue(encoder.encode(roundBuffer));
        }
        roundBuffer = "";
      });
      // Structural logging only — never log full message/tool payloads,
      // which can include invoice/banking data (architecture doc §5).
      runner.on("functionToolCall", (call) => {
        console.log("[chat] tool call:", call.name);
      });
      runner.on("error", (error) => {
        streamErrored = true;
        console.log("[chat] stream error:", error?.name, error?.message);
        controller.error(error);
      });
      runner
        .done()
        .then(() => {
          if (!streamErrored) controller.close();
        })
        .catch(() => {
          // Already surfaced via the 'error' listener above.
        });
    },
    cancel() {
      runner.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
