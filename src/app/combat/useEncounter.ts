import { useCallback, useMemo, useReducer } from "react";
import { useFoundryHook } from "../useFoundryHook";
import { buildEncounterView } from "../../foundry/combat/view";
import type { EncounterLike, EncounterView } from "../../foundry/combat/types";

/** Live encounter view for the active character. Synchronous data-prep (like
 *  `useToggles`/`useHotbar`): re-preps on every combat document hook so round,
 *  turn, roster, and initiative changes reflect within ~1s. Returns null when
 *  there is no active encounter (`game.combat` is null) → the tab's empty state. */
export function useEncounter(actorId: string | null): EncounterView | null {
  const [version, bump] = useReducer((n: number) => n + 1, 0);
  const onCombat = useCallback(() => bump(), []);

  useFoundryHook("updateCombat", onCombat);
  useFoundryHook("createCombat", onCombat);
  useFoundryHook("deleteCombat", onCombat);
  useFoundryHook("createCombatant", onCombat);
  useFoundryHook("updateCombatant", onCombat);
  useFoundryHook("deleteCombatant", onCombat);

  return useMemo(() => {
    const combat = (game as any)?.combat as EncounterLike | null | undefined;
    if (!combat) return null;
    const isGM = !!(game as any)?.user?.isGM;
    return buildEncounterView(combat, { isGM, characterActorId: actorId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, actorId]);
}
