import { useCallback, useMemo, useReducer } from "react";
import { useFoundryHook } from "../useFoundryHook";
import { buildSceneView } from "../../foundry/scene/view";
import type { SceneView } from "../../foundry/scene/types";

/** Live battle-map view for the active character. Synchronous data-prep (like
 *  `useEncounter`): re-preps on the scene/token/actor/combat hooks so moves,
 *  HP changes, and turn changes reflect within ~1s. Returns null when there is
 *  no active scene → the tab's empty state. Reads `scene.dimensions` (canvas-free)
 *  and the current combatant's token id (for the turn ring) from live globals. */
export function useScene(actorId: string | null): SceneView | null {
  const [version, bump] = useReducer((n: number) => n + 1, 0);
  const onChange = useCallback(() => bump(), []);

  useFoundryHook("updateToken", onChange);
  useFoundryHook("createToken", onChange);
  useFoundryHook("deleteToken", onChange);
  useFoundryHook("updateScene", onChange);
  useFoundryHook("createScene", onChange);
  useFoundryHook("deleteScene", onChange);
  useFoundryHook("updateActor", onChange);
  useFoundryHook("createItem", onChange);
  useFoundryHook("updateItem", onChange);
  useFoundryHook("deleteItem", onChange);
  useFoundryHook("updateCombat", onChange);
  useFoundryHook("targetToken", onChange);

  return useMemo(() => {
    const scene = (game as any)?.scenes?.active;
    if (!scene?.dimensions) return null;
    const isGM = !!(game as any)?.user?.isGM;
    const c = (game as any)?.combat?.combatant;
    const currentTokenId =
      c && c.sceneId === scene.id ? (c.tokenId ?? c.token?.id ?? null) : null;
    const targetedIds = ((game as any)?.user?.targets?.ids ?? []) as string[];
    // Read the background from `_source` to avoid Foundry v14's deprecated
    // `Scene#background` getter (which warns on every render); the value is the
    // same. Tokens stay the live collection (the mapper handles `{ contents }`).
    const g = scene.grid;
    const sceneArg = {
      id: scene.id,
      background: { src: scene._source?.background?.src ?? scene.background?.src ?? null },
      grid: g
        ? { type: g.type ?? 1, color: String(g.color ?? "#000000"), alpha: typeof g.alpha === "number" ? g.alpha : 0.2, distance: typeof g.distance === "number" ? g.distance : 5 }
        : null,
      tokens: scene.tokens,
    };
    return buildSceneView(sceneArg, scene.dimensions, { isGM, characterActorId: actorId, currentTokenId, targetedIds });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, actorId]);
}
