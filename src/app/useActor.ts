import { useCallback, useMemo, useReducer } from "react";
import { useFoundryHook } from "./useFoundryHook";
import { buildCharacterView } from "../foundry/actor/view";
import type { CharacterLike, CharacterView } from "../foundry/actor/types";

/** Reads the live actor and rebuilds the view whenever a relevant document
 *  hook fires for THIS actor. Returns null if the actor is gone. */
export function useActor(actorId: string): CharacterView | null {
  const [version, bump] = useReducer((n: number) => n + 1, 0);

  // Bump when an event targets this actor. Items (incl. conditions/effects)
  // carry their owner as `parent`; actor events carry it as the doc itself.
  const onActor = useCallback(
    (doc: any) => { if (doc?.id === actorId) bump(); },
    [actorId],
  );
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
    return buildCharacterView(actor as unknown as CharacterLike);
    // `version` is an intentional invalidation dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actorId, version]);
}
