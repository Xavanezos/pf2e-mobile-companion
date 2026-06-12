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
