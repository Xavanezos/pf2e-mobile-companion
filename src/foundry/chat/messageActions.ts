import { loc } from "../i18n";

/** One native PF2e message action. `kind` drives both the icon/label here and the
 *  live call in messageActionsRun.ts. */
export type ChatMessageActionKind =
  | "reroll-new"
  | "reroll-higher"
  | "reroll-lower"
  | "hero-point"
  | "mythic-point"
  | "delete";

export interface ChatMessageAction {
  kind: ChatMessageActionKind;
  label: string;
  icon: string;
  /** Delete is destructive — the sheet routes it through a confirm step. */
  destructive?: boolean;
}

/** The reduced snapshot the pure mapper decides from. The live glue
 *  (messageActionsRun.ts) builds this from the real ChatMessage, resolving
 *  familiar→master for the resource counts. */
export interface ChatMessageActionSource {
  /** message.isRerollable — owns the actor, authored/owns the message, and
   *  rolls[0] is a not-yet-rerolled CheckRoll (a 1d20 check). */
  isRerollable: boolean;
  /** message.isAuthor || game.user.isGM */
  canDelete: boolean;
  /** Rerolling character's hero points; null when the actor isn't a character. */
  heroPoints: number | null;
  /** Rerolling character's mythic points; null when the actor isn't a character. */
  mythicPoints: number | null;
}

/** Pure: the native PF2e actions applicable to a chat message, in sheet order.
 *  Mirrors chat-log.ts `_getEntryContextOptions` visible-gates. Returns [] when
 *  nothing applies (the long-press then opens no sheet). */
export function messageActions(src: ChatMessageActionSource): ChatMessageAction[] {
  const actions: ChatMessageAction[] = [];
  if (src.isRerollable) {
    actions.push(
      { kind: "reroll-new", label: loc("PF2E.RerollMenu.KeepNew"), icon: "fa-dice" },
      { kind: "reroll-higher", label: loc("PF2E.RerollMenu.KeepHigher"), icon: "fa-dice-six" },
      { kind: "reroll-lower", label: loc("PF2E.RerollMenu.KeepLower"), icon: "fa-dice-one" },
    );
    if ((src.heroPoints ?? 0) > 0) {
      actions.push({ kind: "hero-point", label: loc("PF2E.RerollMenu.HeroPoint"), icon: "fa-circle-h" });
    }
    if ((src.mythicPoints ?? 0) > 0) {
      actions.push({ kind: "mythic-point", label: loc("PF2E.RerollMenu.MythicPoint"), icon: "fa-circle-m" });
    }
  }
  if (src.canDelete) {
    actions.push({ kind: "delete", label: "Delete message", icon: "fa-trash", destructive: true });
  }
  return actions;
}
