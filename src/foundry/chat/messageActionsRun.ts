import type { ChatMessageActionKind, ChatMessageActionSource } from "./messageActions";

/** Build the pure mapper's snapshot from the live ChatMessage. Resolves
 *  familiar→master for the resource counts, mirroring chat-log.ts:466-479.
 *  DOM/Foundry glue — untested. Returns null if the message is gone. */
export function readMessageActionSource(messageId: string): ChatMessageActionSource | null {
  const msg = (game as any)?.messages?.get(messageId);
  if (!msg) return null;
  const actor = msg.actor;
  const rerolling = actor?.isOfType?.("familiar") ? actor.master : actor;
  const isCharacter = !!rerolling?.isOfType?.("character");
  return {
    isRerollable: !!msg.isRerollable,
    canDelete: !!msg.isAuthor || !!(game as any)?.user?.isGM,
    heroPoints: isCharacter ? (rerolling.heroPoints?.value ?? 0) : null,
    mythicPoints: isCharacter ? (rerolling.system?.resources?.mythicPoints?.value ?? 0) : null,
  };
}

/** Guarded like chatActions.ts: a rejected call surfaces via Foundry's toast and
 *  never throws into React. */
async function guard(run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch (err) {
    console.error("[pf2e-mobile] chat message action failed", err);
    (ui as any)?.notifications?.error?.("Message action failed — see console.");
  }
}

/** Run a native PF2e message action via PF2e's own methods. PF2e owns the rules
 *  (reroll math, resource spend, degree of success); we only trigger it. */
export function runMessageAction(messageId: string, kind: ChatMessageActionKind): Promise<void> {
  return guard(async () => {
    const msg = (game as any)?.messages?.get(messageId);
    if (!msg) throw new Error(`no message ${messageId}`);
    if (kind === "delete") return msg.delete();
    const Check = (game as any)?.pf2e?.Check;
    if (!Check?.rerollFromMessage) throw new Error("game.pf2e.Check unavailable");
    switch (kind) {
      case "reroll-new": return Check.rerollFromMessage(msg);
      case "reroll-higher": return Check.rerollFromMessage(msg, { keep: "higher" });
      case "reroll-lower": return Check.rerollFromMessage(msg, { keep: "lower" });
      case "hero-point": return Check.rerollFromMessage(msg, { resource: "hero-points" });
      case "mythic-point": return Check.rerollFromMessage(msg, { resource: "mythic-points" });
    }
  });
}
