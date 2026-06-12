import type {
  CombatantView, EncounterLike, EncounterView, EncounterViewContext,
} from "./types";

/** Pure: build the player-facing encounter view from the live `game.combat`.
 *  Mirrors what Foundry's stock tracker shows a player — GM-hidden combatants
 *  omitted, names blanked when the player may not see them, NPC HP hidden — so
 *  the mapper (not the UI) owns every visibility rule and stays unit-testable.
 *  `turns` is already initiative-sorted by PF2e; we preserve that order. */
export function buildEncounterView(
  encounter: EncounterLike,
  ctx: EncounterViewContext,
): EncounterView {
  const currentId = encounter.combatant?.id ?? null;
  const combatants: CombatantView[] = [];
  let myCombatantId: string | null = null;

  for (const c of encounter.turns ?? []) {
    if (c.hidden && !ctx.isGM) continue; // players never see GM-hidden combatants

    const canSeeName = ctx.isGM || c.playersCanSeeName !== false;
    const isMine = !!c.actor && c.actor.id === ctx.characterActorId;
    const canSeeHp = ctx.isGM || c.actor?.hasPlayerOwner === true;
    const hpRaw = c.actor?.system?.attributes?.hp;
    const hp =
      canSeeHp && hpRaw && typeof hpRaw.value === "number" && typeof hpRaw.max === "number"
        ? { value: hpRaw.value, max: hpRaw.max }
        : null;

    if (isMine) myCombatantId = c.id;
    combatants.push({
      id: c.id,
      name: canSeeName ? c.name : "Unknown",
      img: c.token?.texture?.src ?? c.actor?.img ?? c.img ?? null,
      initiative: c.initiative ?? null,
      isCurrent: c.id === currentId,
      isMine,
      defeated: c.defeated ?? false,
      hp,
    });
  }

  const mine = combatants.find((c) => c.id === myCombatantId) ?? null;
  return {
    round: encounter.round,
    started: encounter.started,
    combatants,
    myCombatantId,
    canRollInitiative: !!mine && mine.initiative == null,
    isMyTurn: !!mine && mine.isCurrent,
  };
}
