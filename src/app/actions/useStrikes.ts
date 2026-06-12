import { useCallback, useMemo, useReducer } from "react";
import { useFoundryHook } from "../useFoundryHook";
import { buildStrikesView } from "../../foundry/actor/strikes";
import type { StrikeActorLike, StrikesView } from "../../foundry/actor/types";

/** Live strikes view for the active actor. `actor.system.actions` is prepared
 *  synchronously, so this mirrors `useActor` (a memo invalidated by a version
 *  bump) rather than the async `useSpells`. Re-preps on actor/item hooks so MAP
 *  labels and `ready` stay live as effects/equipment change. Returns null if the
 *  actor is gone. */
export function useStrikes(actorId: string): StrikesView | null {
  const [version, bump] = useReducer((n: number) => n + 1, 0);

  const onActor = useCallback((doc: any) => { if (doc?.id === actorId) bump(); }, [actorId]);
  const onItem = useCallback(
    (doc: any) => { if ((doc?.parent?.id ?? doc?.actor?.id) === actorId) bump(); },
    [actorId],
  );

  useFoundryHook("updateActor", onActor);
  useFoundryHook("createItem", onItem);
  useFoundryHook("updateItem", onItem);
  useFoundryHook("deleteItem", onItem);

  return useMemo(() => {
    const actor = (game as any).actors.get(actorId);
    if (!actor) return null;
    return buildStrikesView(actor as StrikeActorLike);
    // `version` is an intentional invalidation dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actorId, version]);
}
