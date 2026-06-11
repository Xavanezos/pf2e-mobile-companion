import { useEffect, useRef } from "react";
import { renderMessageElement } from "../../foundry/chat/render";
import type { ChatView } from "../../foundry/chat/types";

/** Mounts the live PF2e card element for one message; falls back to the summary
 *  title if the message is gone or won't render. */
export function ChatCard({ summary }: { summary: ChatView }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let alive = true;
    const host = ref.current;
    if (!host) return;
    renderMessageElement(summary.id).then((el) => {
      if (!alive || !host) return;
      if (el) host.replaceChildren(el);
      else host.textContent = summary.title;
    });
    return () => { alive = false; host?.replaceChildren(); };
  }, [summary.id, summary.title]);
  return <div ref={ref} className="pf2e-chat-card" />;
}
