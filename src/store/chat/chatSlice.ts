import { createSlice, PayloadAction } from "@reduxjs/toolkit";

import type { ConversationSummary } from "../../lib/chatHistory/types";
import { isSessionBoundary } from "../sessionBoundary";
import { deleteConversation, fetchConversations, openConversation, saveCurrentConversation } from "./chatApi";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ChatState {
  messages: ChatMessage[];
  status: "idle" | "streaming" | "error";
  error: string | null;

  // ── Chat history (persisted server-side, see lib/chatHistory) ────────────
  /**
   * Id of the record the live `messages` belong to. null until the first save
   * comes back — the SERVER mints conversation ids, so the client never
   * invents one (lib/chatHistory/store.ts).
   */
  conversationId: string | null;
  /** Summaries for the history list; bodies are fetched on open. */
  conversations: ConversationSummary[];
  historyStatus: "idle" | "loading" | "error";
  historyError: string | null;
  /**
   * Why there's no `openStatus` here: which ROW is opening is per-row UI state
   * that only ChatPanel needs, so it lives there. Only the error has to
   * survive into the list's render.
   */
  openError: string | null;
}

const initialState: ChatState = {
  messages: [],
  status: "idle",
  error: null,
  conversationId: null,
  conversations: [],
  historyStatus: "idle",
  historyError: null,
  openError: null,
};

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    sendMessage: (state, action: PayloadAction<ChatMessage>) => {
      state.messages.push(action.payload);
      state.status = "streaming";
      state.error = null;
    },

    // Assistant's in-progress streamed message — created empty as soon as the
    // request starts, then grown token-by-token via appendAssistantChunk so
    // the UI can render it live instead of waiting for the whole answer.
    startAssistantMessage: (state, action: PayloadAction<{ id: string }>) => {
      state.messages.push({ id: action.payload.id, role: "assistant", content: "" });
    },

    appendAssistantChunk: (state, action: PayloadAction<{ id: string; delta: string }>) => {
      const message = state.messages.find((m) => m.id === action.payload.id);
      if (message) message.content += action.payload.delta;
    },

    streamCompleted: (state) => {
      state.status = "idle";
    },

    streamFailed: (state, action: PayloadAction<string>) => {
      state.status = "error";
      state.error = action.payload;
    },

    // Cleared both on logout/login (session boundary, below) and whenever
    // the active QuickBooks company changes — a conversation started while
    // looking at Company A's invoices must not keep answering as if it's
    // still Company A after the user switches companies (architecture doc
    // §5, §7.8). The qbConnectionId-change case is wired from ChatWidget,
    // since only the component tree knows when that id actually changed.
    //
    // Also drops the cached summaries: they're scoped to the company that was
    // active when they were fetched, so they'd be the wrong list afterwards.
    clearChat: () => initialState,

    // "New chat": start a fresh record, keeping the loaded history list. Only
    // the transcript and its record id reset — an already-saved conversation
    // stays saved, since the next save has no id and the server mints a new one.
    startNewConversation: (state) => {
      state.messages = [];
      state.status = "idle";
      state.error = null;
      state.conversationId = null;
      state.openError = null;
    },
  },

  extraReducers: (builder) => {
    builder
      // ── LIST ──
      .addCase(fetchConversations.pending, (state) => {
        state.historyStatus = "loading";
        state.historyError = null;
        // Opening the list is also the user's "try again" — don't greet them
        // with the failure from the last conversation they tried to open.
        state.openError = null;
      })
      .addCase(fetchConversations.fulfilled, (state, action) => {
        state.historyStatus = "idle";
        state.conversations = action.payload;
      })
      .addCase(fetchConversations.rejected, (state, action) => {
        state.historyStatus = "error";
        state.historyError = action.payload?.message || "Failed to load chat history";
      })

      // ── OPEN ──
      .addCase(openConversation.pending, (state) => {
        state.openError = null;
      })
      .addCase(openConversation.fulfilled, (state, action) => {
        state.messages = action.payload.messages.map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
        }));
        state.conversationId = action.payload.id;
        state.status = "idle";
        state.error = null;
      })
      .addCase(openConversation.rejected, (state, action) => {
        state.openError = action.payload?.message || "Failed to open conversation";
      })

      // ── SAVE ──
      // Deliberately does not surface a status: saving is a background side
      // effect of chatting, and a failed save must not cover the answer the
      // user is reading. The summary that comes back carries the server-minted
      // id, which is what later saves and re-opens address.
      .addCase(saveCurrentConversation.fulfilled, (state, action) => {
        if (!action.payload) return;
        state.conversationId = action.payload.id;
        const index = state.conversations.findIndex((c) => c.id === action.payload!.id);
        if (index >= 0) state.conversations[index] = action.payload;
        else state.conversations.unshift(action.payload);
      })

      // ── DELETE ──
      // Removed from the list only once the SERVER confirms it's gone, so a
      // failed delete can't leave the UI claiming a conversation no longer
      // exists while it still does.
      .addCase(deleteConversation.fulfilled, (state, action) => {
        state.conversations = state.conversations.filter((c) => c.id !== action.payload);
        if (state.conversationId === action.payload) {
          state.conversationId = null;
          state.messages = [];
        }
      })
      .addCase(deleteConversation.rejected, (state, action) => {
        state.historyError = action.payload?.message || "Failed to delete conversation";
      })

      // Not persisted (see store/index.ts's persist whitelist), but still
      // alive in memory for the tab's lifetime — reset on every session
      // start/end so one account's conversation can't survive into the next
      // session on a shared browser (architecture doc §5, §7.9), same pattern
      // as invoiceSlice.ts/quickBooksSlice.ts. This now matters more, not
      // less: `conversations` holds the previous account's titles until it runs.
      .addMatcher(isSessionBoundary, () => initialState);
  },
});

export const {
  sendMessage,
  startAssistantMessage,
  appendAssistantChunk,
  streamCompleted,
  streamFailed,
  clearChat,
  startNewConversation,
} = chatSlice.actions;
export default chatSlice.reducer;
