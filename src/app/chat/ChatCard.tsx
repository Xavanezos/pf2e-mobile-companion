import { useEffect, useRef } from "react";
import { renderMessageElement } from "../../foundry/chat/render";
import { classifyCardClick, type CardInteraction } from "../../foundry/chat/cardInteractions";
import type { ChatView } from "../../foundry/chat/types";

/** Mounts the live PF2e card element for one message; falls back to the summary
 *  title if the message is gone or won't render. A capture-phase click listener
 *  intercepts the damage/save/effect controls (whose native handlers are dead on
 *  mobile) and reports them via `onInteract`. */
export function ChatCard({ summary, onInteract }: { summary: ChatView; onInteract?: (i: CardInteraction) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let alive = true;
    const host = ref.current;
    if (!host) return;
    const onClick = (e: MouseEvent) => {
      if (!onInteract) return;
      const hit = classifyCardClick(e.target as Element, summary.id);
      if (hit) {
        e.preventDefault();
        e.stopPropagation();
        onInteract(hit);
      }
    };
    host.addEventListener("click", onClick, true); // capture → runs before PF2e's button listener
    renderMessageElement(summary.id).then((el) => {
      if (!alive || !host) return;
      if (el) host.replaceChildren(el);
      else host.textContent = summary.title;
    });
    return () => {
      alive = false;
      host?.removeEventListener("click", onClick, true);
      host?.replaceChildren();
    };
  }, [summary.id, summary.title, onInteract]);
  return <div ref={ref} className="pf2e-chat-card" />;
}
