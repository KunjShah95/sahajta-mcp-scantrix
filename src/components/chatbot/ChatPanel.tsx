"use client";

import { Puzzle, Send, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { KeyboardEvent, useEffect, useRef, useState } from "react";

import { ChatMessage } from "@/components/chatbot/ChatMessage";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { SESSION_EXPIRED, sessionEmitter } from "@/lib/sessionManager";
import { appendAssistantChunk, sendMessage, startAssistantMessage, streamCompleted, streamFailed } from "@/store/chat/chatSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

let nextMessageId = 0;
const newMessageId = () => `chat-${Date.now()}-${++nextMessageId}`;

export function ChatPanel({ companyName, onClose }: { companyName?: string; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const accessToken: string | undefined = useAppSelector((state) => state.auth.user?.data?.accessToken);
  const qbConnectionId = useAppSelector((state) => state.quickBooks.qbConnectionId);
  const messages = useAppSelector((state) => state.chat.messages);
  const status = useAppSelector((state) => state.chat.status);
  const error = useAppSelector((state) => state.chat.error);

  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const streaming = status === "streaming";

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || streaming || !accessToken || !qbConnectionId) return;

    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setInput("");
    dispatch(sendMessage({ id: newMessageId(), role: "user", content: text }));
    const assistantId = newMessageId();
    dispatch(startAssistantMessage({ id: assistantId }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "X-QB-Id": qbConnectionId,
        },
        body: JSON.stringify({ message: text, history, companyName }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          sessionEmitter.emit(SESSION_EXPIRED);
        }
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Something went wrong. Please try again.");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("Streaming isn't supported in this browser.");
      const decoder = new TextDecoder();

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const delta = decoder.decode(value, { stream: true });
        if (delta) dispatch(appendAssistantChunk({ id: assistantId, delta }));
      }

      dispatch(streamCompleted());
    } catch (err) {
      dispatch(streamFailed(err instanceof Error ? err.message : "Something went wrong. Please try again."));
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handlePanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") onClose();
  };

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      onKeyDown={handlePanelKeyDown}
      role="dialog"
      aria-modal="true"
      aria-label="Chat assistant"
      className="fixed inset-y-0 right-0 z-[90] flex h-screen w-full max-w-md flex-col border-l border-border bg-white shadow-xl outline-none"
    >
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-[var(--space-lg)]">
        <div className="min-w-0">
          <h2 className="truncate text-h3 font-bold text-trust-navy">Assistant</h2>
          {companyName && <p className="truncate text-caption text-text-secondary">{companyName}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close chat"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-text-secondary hover:bg-background-alt"
        >
          <X size={18} strokeWidth={2} />
        </button>
      </div>

      {!qbConnectionId ? (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            icon={<Puzzle size={28} strokeWidth={1.75} />}
            title="Connect QuickBooks to chat"
            description="The assistant answers questions about your invoices, vendors, and accounts — connect a QuickBooks company first."
            actionLabel="Go to Integrations"
            onAction={() => router.push("/accounting-software")}
          />
        </div>
      ) : (
        <>
          <div ref={listRef} className="flex-1 space-y-[var(--space-md)] overflow-y-auto px-[var(--space-lg)] py-[var(--space-md)]">
            {messages.length === 0 && (
              <p className="pt-[var(--space-xl)] text-center text-body-sm text-text-secondary">
                Ask about invoices, vendors, GL accounts, or spend — for the currently active company only.
              </p>
            )}
            {messages.map((message, index) => (
              <div
                key={message.id}
                aria-live={index === messages.length - 1 && streaming ? "off" : "polite"}
              >
                <ChatMessage message={message} />
              </div>
            ))}
            {status === "error" && error && <ErrorState message={error} />}
          </div>

          <div className="shrink-0 border-t border-border p-[var(--space-md)]">
            <div className="flex items-end gap-[var(--space-sm)]">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                disabled={streaming || !accessToken}
                placeholder="Ask about your invoices, vendors, spend…"
                rows={2}
                className="min-h-[44px] flex-1 resize-none rounded-md border border-border px-[var(--space-md)] py-[var(--space-sm)] text-body-sm text-text-primary outline-none focus:border-primary disabled:opacity-60"
              />
              <Button
                type="button"
                size="sm"
                loading={streaming}
                disabled={!input.trim() || !accessToken}
                onClick={handleSend}
                aria-label="Send message"
              >
                <Send size={16} strokeWidth={2} />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
