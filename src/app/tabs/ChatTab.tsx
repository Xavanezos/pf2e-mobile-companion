import { useEffect, useRef, useState } from "react";
import { useChatStore } from "../chatStore";
import { useAppStore } from "../store";
import { ChatCard } from "../chat/ChatCard";
import { DamageRollModal } from "../chat/DamageRollModal";
import { SaveRollModal } from "../chat/SaveRollModal";
import { SpellEffectModal } from "../chat/SpellEffectModal";
import { isNearBottom } from "../chat/scroll";
import type { CardInteraction } from "../../foundry/chat/cardInteractions";

/** The Chat tab: full scrollable history, newest at the bottom, auto-scrolled.
 *  Taps on a card's damage/save/effect controls open a mobile popup. */
export function ChatTab() {
  const messages = useChatStore((s) => s.messages);
  const actorId = useAppStore((s) => s.actorId);
  const [popup, setPopup] = useState<CardInteraction | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  // Stay pinned to the newest message until the user scrolls up to read history.
  const stick = useRef(true);

  // Each ChatCard injects its real PF2e content asynchronously, so on reload the
  // list mounts near-empty and grows over several frames. A one-shot scroll fires
  // against that empty list and leaves us at the top. Instead, re-pin to the
  // bottom on every size change while the user is following the feed — a
  // ResizeObserver waits for the actual layout rather than guessing a delay.
  useEffect(() => {
    const el = list.current;
    if (!el) return;
    const scroller = el.parentElement; // Shell's <main overflow-y-auto>
    const pin = () => { if (stick.current) bottom.current?.scrollIntoView({ block: "end" }); };
    const onScroll = () => {
      if (scroller) stick.current = isNearBottom(scroller.scrollHeight, scroller.scrollTop, scroller.clientHeight);
    };
    pin();
    const ro = new ResizeObserver(pin);
    ro.observe(el);
    scroller?.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      ro.disconnect();
      scroller?.removeEventListener("scroll", onScroll);
    };
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-zinc-500">
        <i className="fas fa-comments text-3xl" aria-hidden="true" />
        <div className="text-zinc-300">No messages yet.</div>
        <div className="text-sm">Rolls and chat will appear here.</div>
      </div>
    );
  }
  const close = () => setPopup(null);
  return (
    <div ref={list} className="flex flex-col gap-2 p-3">
      {messages.map((m) => <ChatCard key={m.id} summary={m} onInteract={setPopup} />)}
      <div ref={bottom} />
      {popup?.kind === "damage" && <DamageRollModal messageId={popup.messageId} onClose={close} />}
      {popup?.kind === "save" && actorId && (
        <SaveRollModal actorId={actorId} saveType={popup.saveType} dc={popup.dc} messageId={popup.messageId} onClose={close} />
      )}
      {popup?.kind === "effect" && actorId && (
        <SpellEffectModal actorId={actorId} uuid={popup.uuid} onClose={close} />
      )}
    </div>
  );
}
