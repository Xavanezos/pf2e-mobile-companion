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

export interface CharacterResolution {
  /** Initial selection: the assigned character, else the sole owned one, else null (must pick). */
  defaultId: string | null;
  /** Every owned `character`-type actor — the switch list. */
  candidates: ActorSummary[];
}

/**
 * Resolve the player's characters:
 *  - `candidates` = all owned PCs (the switch list);
 *  - `defaultId` = the assigned `user.character` if set, else the sole owned PC, else null.
 *
 * Always exposing the full candidate list means a player with several PCs can switch
 * between them even when the GM has assigned a default one.
 */
export function resolveCharacter(game: MinimalGame): CharacterResolution {
  const owned = game.actors.filter((a) => a.isOwner && a.type === "character");
  const candidates: ActorSummary[] = owned.map((a) => ({ id: a.id, name: a.name, img: a.img }));
  const assignedId = game.user.character?.id ?? null;
  const defaultId = assignedId ?? (owned.length === 1 ? owned[0].id : null);
  return { defaultId, candidates };
}
