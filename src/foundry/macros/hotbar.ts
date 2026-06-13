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

interface ExecutableMacro { execute(scope?: { actor?: unknown; token?: unknown }): unknown; }
interface TokenedActor { getActiveTokens?: () => unknown[]; }

/** Guarded: run a hotbar macro exactly like clicking the desktop hotbar. Passes
 *  the app's active actor as scope, plus its active Token placeable when one is on
 *  the viewed scene — the Map tab (which hosts the bar) keeps the canvas live, so
 *  script macros that read the `token` param / `canvas.tokens.controlled` resolve
 *  it. Falls back to actor-only, then empty, when absent. Never throws into React;
 *  a failure surfaces via Foundry's toast. */
export function executeMacro(macroId: string, actorId: string | null): Promise<void> {
  return (async () => {
    try {
      const macro = (game as any)?.macros?.get(macroId) as ExecutableMacro | undefined;
      if (!macro?.execute) throw new Error(`macro ${macroId} not executable`);
      const actor = actorId ? ((game as any)?.actors?.get(actorId) as TokenedActor | undefined) : undefined;
      const token = actor?.getActiveTokens?.()?.[0];
      const scope: { actor?: unknown; token?: unknown } = {};
      if (actor) scope.actor = actor;
      if (token) scope.token = token;
      await macro.execute(scope);
    } catch (err) {
      console.error("[pf2e-mobile] executeMacro failed", err);
      (ui as any)?.notifications?.error?.("Macro failed — see console.");
    }
  })();
}
