import { useCallback, useMemo, useReducer } from "react";
import { useFoundryHook } from "../useFoundryHook";
import { buildTogglesView } from "../../foundry/actor/toggles";
import type { TogglesActorLike, TogglesView } from "../../foundry/actor/types";

/** Live combat roll-option toggles for the active actor. Synchronous data-prep
 *  (like `useStrikes`/`useActionsList`); re-preps on actor/item hooks so a flipped
 *  toggle (and toggles added by equipping/effects) reflect live. Null if gone. */
export function useToggles(actorId: string): TogglesView | null {
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
    return buildTogglesView(actor as TogglesActorLike);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actorId, version]);
}
