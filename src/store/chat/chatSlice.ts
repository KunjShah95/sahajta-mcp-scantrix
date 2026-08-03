import { createSlice, PayloadAction } from "@reduxjs/toolkit";

import { isSessionBoundary } from "../sessionBoundary";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ChatState {
  messages: ChatMessage[];
  status: "idle" | "streaming" | "error";
  error: string | null;
}

const initialState: ChatState = {
  messages: [],
  status: "idle",
  error: null,
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
    clearChat: () => initialState,
  },

  extraReducers: (builder) => {
    // Not persisted (see store/index.ts's persist whitelist), but still
    // alive in memory for the tab's lifetime — reset on every session
    // start/end so one account's conversation can't survive into the next
    // session on a shared browser (architecture doc §5, §7.9), same pattern
    // as invoiceSlice.ts/quickBooksSlice.ts.
    builder.addMatcher(isSessionBoundary, () => initialState);
  },
});

export const { sendMessage, startAssistantMessage, appendAssistantChunk, streamCompleted, streamFailed, clearChat } =
  chatSlice.actions;
export default chatSlice.reducer;
