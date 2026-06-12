import { useCallback, useMemo, useReducer } from "react";
import { useFoundryHook } from "../useFoundryHook";
import { buildHotbarView } from "../../foundry/macros/hotbar";
import type { HotbarUserLike, HotbarView, MacroLike } from "../../foundry/macros/types";

/** Live macro-bar view from the player's hotbar. Synchronous data-prep (like
 *  `useToggles`): re-preps when the hotbar changes (`updateUser`) or a macro's
 *  name/icon changes or is deleted (`updateMacro`/`deleteMacro`) — so a slot
 *  rearranged on desktop reflects live. Null only if `game.user` is absent. */
export function useHotbar(): HotbarView | null {
  const [version, bump] = useReducer((n: number) => n + 1, 0);

  const onUser = useCallback((doc: any) => {
    if (doc?.id === (game as any)?.user?.id) bump();
  }, []);
  const onMacro = useCallback(() => bump(), []);

  useFoundryHook("updateUser", onUser);
  useFoundryHook("updateMacro", onMacro);
  useFoundryHook("deleteMacro", onMacro);

  return useMemo(() => {
    const user = (game as any)?.user as HotbarUserLike | undefined;
    if (!user) return null;
    return buildHotbarView(user, (id: string) => (game as any)?.macros?.get(id) as MacroLike | undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);
}
