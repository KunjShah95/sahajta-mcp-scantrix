import { Bot, User } from "lucide-react";

import type { ChatMessage as ChatMessageType } from "@/store/chat/chatSlice";

export function ChatMessage({ message }: { message: ChatMessageType }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex items-start gap-[var(--space-sm)] ${isUser ? "flex-row-reverse" : ""}`}>
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isUser ? "bg-trust-navy text-white" : "bg-primary/10 text-primary"
        }`}
      >
        {isUser ? <User size={16} strokeWidth={2} /> : <Bot size={16} strokeWidth={2} />}
      </span>
      <div
        className={`max-w-[80%] whitespace-pre-wrap rounded-lg px-[var(--space-md)] py-[var(--space-sm)] text-body-sm ${
          isUser ? "bg-trust-navy text-white" : "bg-background-alt text-text-primary"
        }`}
      >
        {message.content || (
          <span className="inline-flex gap-1" aria-hidden>
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
          </span>
        )}
      </div>
    </div>
  );
}
