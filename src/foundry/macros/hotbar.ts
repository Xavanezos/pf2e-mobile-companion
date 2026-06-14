import type { HotbarUserLike, HotbarView, MacroLike } from "./types";

/** Pure: flatten the player's hotbar (all 5 pages) into slot-ordered macro
 *  buttons, resolving each id via `getMacro` and skipping dangling slots
 *  (macro deleted or not visible to the player). Mirrors how the desktop
 *  hotbar reads `user.hotbar`; the hook passes `id => game.macros.get(id)`. */
export function buildHotbarView(
  user: HotbarUserLike,
  getMacro: (id: string) => MacroLike | undefined,
): HotbarView {
  const slots = Object.entries(user.hotbar ?? {})
    .map(([slot, id]) => [Number(slot), id] as const)
    .sort((a, b) => a[0] - b[0]);
  const out: HotbarView = [];
  for (const [slot, id] of slots) {
    const macro = getMacro(id);
    if (!macro) continue; // dangling: deleted / not visible → skip, no gap
    out.push({
      id,
      slot,
      name: macro.name ?? "",
      img: macro.img ?? null,
      canExecute: macro.canExecute !== false,
    });
  }
  return out;
}

interface ExecutableMacro { execute(scope?: Record<string, unknown>): unknown; }
interface TokenedActor { getActiveTokens?: () => unknown[]; }

/** Guarded: run a hotbar macro like clicking the desktop hotbar. On desktop Foundry
 *  fills a script macro's `actor` / `token` / `character` / `speaker` params from the
 *  controlled token and the user's assigned character. The mobile takeover hides the
 *  canvas controls, so there's no controlled token and `game.user.character` is often
 *  unset — leaving those params undefined, so any macro that reads them throws. Foundry
 *  swallows that throw into a notifications toast (which the takeover hides), so the
 *  macro just appears to do nothing. Supply all four from the app's active actor: its
 *  placed token on the viewed scene, the user's character (or the actor as a fallback),
 *  and a matching speaker. Never throws into React. */
export function executeMacro(macroId: string, actorId: string | null): Promise<void> {
  return (async () => {
    try {
      const macro = (game as any)?.macros?.get(macroId) as ExecutableMacro | undefined;
      if (!macro?.execute) throw new Error(`macro ${macroId} not executable`);
      const actor = actorId ? ((game as any)?.actors?.get(actorId) as TokenedActor | undefined) : undefined;
      const token = actor?.getActiveTokens?.()?.[0];
      const scope: Record<string, unknown> = {};
      if (actor) {
        scope.actor = actor;
        const character = (game as any)?.user?.character ?? actor;
        if (character) scope.character = character;
        const speaker = (globalThis as any)?.ChatMessage?.getSpeaker?.(token ? { token } : { actor });
        if (speaker) scope.speaker = speaker;
      }
      if (token) scope.token = token;
      await macro.execute(scope);
    } catch (err) {
      console.error("[pf2e-mobile] executeMacro failed", err);
      (ui as any)?.notifications?.error?.("Macro failed — see console.");
    }
  })();
}
