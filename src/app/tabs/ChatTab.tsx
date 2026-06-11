import { useEffect, useRef } from "react";
import { useChatStore } from "../chatStore";
import { ChatCard } from "../chat/ChatCard";

/** The Chat tab: full scrollable history, newest at the bottom, auto-scrolled. */
export function ChatTab() {
  const messages = useChatStore((s) => s.messages);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-zinc-500">
        <i className="fas fa-comments text-3xl" aria-hidden="true" />
        <div className="text-zinc-300">No messages yet.</div>
        <div className="text-sm">Rolls and chat will appear here.</div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 p-3">
      {messages.map((m) => <ChatCard key={m.id} summary={m} />)}
      <div ref={bottom} />
    </div>
  );
}
