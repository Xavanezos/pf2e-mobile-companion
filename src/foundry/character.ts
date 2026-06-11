export interface ActorSummary {
  id: string;
  name: string;
  img?: string;
}

export interface MinimalActor {
  id: string;
  name: string;
  type: string;
  isOwner: boolean;
  img?: string;
}

export interface MinimalGame {
  user: { character: { id: string } | null };
  actors: { filter(predicate: (a: MinimalActor) => boolean): MinimalActor[] };
}

export type CharacterResolution =
  | { kind: "resolved"; actorId: string }
  | { kind: "picker"; candidates: ActorSummary[] }
  | { kind: "none" };

/**
 * Decide which character to show:
 *  - the assigned `user.character` if set;
 *  - else owned PF2e `character`-type actors: 0 → none, 1 → auto-select, 2+ → picker.
 */
export function resolveCharacter(game: MinimalGame): CharacterResolution {
  const assigned = game.user.character;
  if (assigned) return { kind: "resolved", actorId: assigned.id };

  const owned = game.actors.filter((a) => a.isOwner && a.type === "character");
  if (owned.length === 0) return { kind: "none" };
  if (owned.length === 1) return { kind: "resolved", actorId: owned[0].id };
  return {
    kind: "picker",
    candidates: owned.map((a) => ({ id: a.id, name: a.name, img: a.img })),
  };
}
