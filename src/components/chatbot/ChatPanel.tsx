"use client";

import { ArrowLeft, History, Plus, Puzzle, Send, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";

import { ChatHistoryList } from "@/components/chatbot/ChatHistoryList";
import { ChatMessage } from "@/components/chatbot/ChatMessage";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { confirmDialog } from "@/lib/dialogManager";
import { SESSION_EXPIRED, sessionEmitter } from "@/lib/sessionManager";
import { deleteConversation, fetchConversations, openConversation, saveCurrentConversation } from "@/store/chat/chatApi";
import {
  appendAssistantChunk,
  sendMessage,
  startAssistantMessage,
  startNewConversation,
  streamCompleted,
  streamFailed,
} from "@/store/chat/chatSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

let nextMessageId = 0;
const newMessageId = () => `chat-${Date.now()}-${++nextMessageId}`;

type View = "chat" | "history";

export function ChatPanel({ companyName, onClose }: { companyName?: string; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const accessToken: string | undefined = useAppSelector((state) => state.auth.user?.data?.accessToken);
  const qbConnectionId = useAppSelector((state) => state.quickBooks.qbConnectionId);
  const messages = useAppSelector((state) => state.chat.messages);
  const status = useAppSelector((state) => state.chat.status);
  const error = useAppSelector((state) => state.chat.error);
  const conversations = useAppSelector((state) => state.chat.conversations);
  const historyStatus = useAppSelector((state) => state.chat.historyStatus);
  const historyError = useAppSelector((state) => state.chat.historyError);
  const openError = useAppSelector((state) => state.chat.openError);

  const [input, setInput] = useState("");
  const [view, setView] = useState<View>("chat");
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const streaming = status === "streaming";

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  const loadHistory = useCallback(() => {
    if (!accessToken || !qbConnectionId) return;
    dispatch(fetchConversations());
  }, [accessToken, qbConnectionId, dispatch]);

  // Fetch on entering the history view, and re-fetch if the active company
  // changes while it's open — the list is scoped to that company server-side,
  // so the rows on screen would otherwise belong to the previous one.
  useEffect(() => {
    if (view === "history") loadHistory();
  }, [view, loadHistory]);

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
    } finally {
      // Persist once per completed turn — NOT per streamed token. The obvious
      // "save whenever messages change" effect fires on every
      // appendAssistantChunk, which would mean one POST per token.
      //
      // Runs on the failure path too, so a question whose answer errored out is
      // still in the user's history. Dispatched without awaiting and reading
      // state at call time (see saveCurrentConversation): saving is a
      // background effect and must never block or replace the answer on screen.
      dispatch(saveCurrentConversation());
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handlePanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // In the history view, Escape steps back to the chat instead of closing the
    // whole panel — closing from a sub-view loses the user's place.
    if (event.key !== "Escape") return;
    if (view === "history") setView("chat");
    else onClose();
  };

  const handleSelectConversation = async (id: string) => {
    setOpeningId(id);
    try {
      const result = await dispatch(openConversation(id));
      // Stay on the list when it fails, so the error is visible next to the row
      // the user tried to open.
      if (openConversation.fulfilled.match(result)) setView("chat");
    } finally {
      setOpeningId(null);
    }
  };

  const handleDeleteConversation = async (id: string) => {
    // Deleting is irreversible — there's no trash to restore from — so it goes
    // through the app's shared confirm dialog like every other destructive
    // action here, rather than deleting straight off a hover button.
    const confirmed = await confirmDialog({
      title: "Delete this conversation?",
      message: "It will be removed from your chat history. This can't be undone.",
      confirmLabel: "Delete",
      tone: "destructive",
    });
    if (!confirmed) return;

    setDeletingId(id);
    try {
      await dispatch(deleteConversation(id));
    } finally {
      setDeletingId(null);
    }
  };

  const handleNewChat = () => {
    dispatch(startNewConversation());
    setView("chat");
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
      <div className="flex h-16 shrink-0 items-center gap-[var(--space-xs)] border-b border-border px-[var(--space-lg)]">
        {view === "history" && (
          <button
            type="button"
            onClick={() => setView("chat")}
            aria-label="Back to chat"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-text-secondary hover:bg-background-alt"
          >
            <ArrowLeft size={18} strokeWidth={2} />
          </button>
        )}

        <div className="min-w-0 flex-1">
          <h2 className="truncate text-h3 font-bold text-trust-navy">
            {view === "history" ? "Chat history" : "Assistant"}
          </h2>
          {companyName && <p className="truncate text-caption text-text-secondary">{companyName}</p>}
        </div>

        {view === "chat" && qbConnectionId && (
          <>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={handleNewChat}
                aria-label="Start a new chat"
                title="New chat"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-text-secondary hover:bg-background-alt"
              >
                <Plus size={18} strokeWidth={2} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setView("history")}
              aria-label="View chat history"
              title="Chat history"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-text-secondary hover:bg-background-alt"
            >
              <History size={18} strokeWidth={2} />
            </button>
          </>
        )}

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
      ) : view === "history" ? (
        <ChatHistoryList
          conversations={conversations}
          status={historyStatus}
          // An open that failed is reported here, next to the row that failed;
          // a list-level failure otherwise.
          error={openError ?? historyError}
          openingId={openingId}
          deletingId={deletingId}
          onSelect={handleSelectConversation}
          onDelete={handleDeleteConversation}
          onRetry={loadHistory}
        />
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
