import { useCallback, useEffect, useRef, useState } from "react";
import { useFoundryHook } from "../useFoundryHook";
import { buildSpellsView } from "../../foundry/spells/view";
import type { SpellsView } from "../../foundry/spells/types";

/** Live spells view for the active actor. Builds asynchronously (each entry's
 *  `getSheetData()` is async) on mount and on item/actor changes filtered to this
 *  actor. A request counter drops stale builds. Returns null while first building
 *  or when the actor has no spellcasting. Mounted by SpellsPanel. */
export function useSpells(actorId: string): SpellsView | null {
  const [view, setView] = useState<SpellsView | null>(null);
  const reqId = useRef(0);

  const rebuild = useCallback(() => {
    const actor = (game as any)?.actors?.get(actorId);
    if (!actor) {
      setView(null);
      return;
    }
    const id = ++reqId.current;
    buildSpellsView(actor)
      .then((v) => {
        if (id === reqId.current) setView(v);
      })
      .catch(() => {});
  }, [actorId]);

  useEffect(() => {
    rebuild();
  }, [rebuild]);

  const onActor = useCallback((doc: any) => { if (doc?.id === actorId) rebuild(); }, [actorId, rebuild]);
  const onItem = useCallback(
    (doc: any) => {
      const aId = doc?.actor?.id ?? doc?.parent?.id;
      if (aId === actorId) rebuild();
    },
    [actorId, rebuild],
  );

  useFoundryHook("updateActor", onActor);
  useFoundryHook("createItem", onItem);
  useFoundryHook("updateItem", onItem);
  useFoundryHook("deleteItem", onItem);

  return view;
}
