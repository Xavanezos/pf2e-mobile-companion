import { useEffect, useRef, useState } from "react";
import { useChatStore } from "../chatStore";
import { useAppStore } from "../store";
import { ChatCard } from "../chat/ChatCard";
import { DamageRollModal } from "../chat/DamageRollModal";
import { SaveRollModal } from "../chat/SaveRollModal";
import { SpellEffectModal } from "../chat/SpellEffectModal";
import type { CardInteraction } from "../../foundry/chat/cardInteractions";

/** The Chat tab: full scrollable history, newest at the bottom, auto-scrolled.
 *  Taps on a card's damage/save/effect controls open a mobile popup. */
export function ChatTab() {
  const messages = useChatStore((s) => s.messages);
  const actorId = useAppStore((s) => s.actorId);
  const [popup, setPopup] = useState<CardInteraction | null>(null);
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
  const close = () => setPopup(null);
  return (
    <div className="flex flex-col gap-2 p-3">
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
