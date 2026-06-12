/** Guarded combat dispatches. Thin glue over the live `game.combat`; a rejected
 *  call (e.g. a player lacking turn-control permission) surfaces via Foundry's
 *  toast and never throws into React — same contract as `rolls.ts`/`hotbar.ts`. */

interface LiveActor {
  system?: { initiative?: { statistic?: string } };
  update?(data: Record<string, unknown>): Promise<unknown>;
}

interface LiveEncounter {
  combatant?: { actor?: { id?: string } | null } | null;
  rollInitiative?(ids: string[], options?: Record<string, unknown>): Promise<unknown>;
  nextTurn?(): Promise<unknown>;
}

function activeEncounter(): LiveEncounter | undefined {
  return (game as any)?.combat as LiveEncounter | undefined;
}

async function guard(run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch (err) {
    console.error("[pf2e-mobile] combat action failed", err);
    (ui as any)?.notifications?.error?.("Action failed — see console.");
  }
}

/** Roll a combatant's initiative using the chosen statistic. PF2e locks
 *  `actor.initiative` to one statistic at build time (set on the sheet), so we
 *  set `system.initiative.statistic` first (exactly what the sheet's selector
 *  does) and only when it changes, then roll. `skipDialog: true` mirrors every
 *  other roll in the app (`rolls.ts`) — without it PF2e opens a CheckModifiers
 *  dialog that the mobile takeover CSS-hides, so the roll would silently block. */
export function rollInitiativeWith(actorId: string, combatantId: string, statistic: string): Promise<void> {
  return guard(async () => {
    const combat = activeEncounter();
    if (!combat?.rollInitiative) throw new Error("no active encounter");
    const actor = (game as any)?.actors?.get(actorId) as LiveActor | undefined;
    if (actor?.update && actor.system?.initiative?.statistic !== statistic) {
      await actor.update({ "system.initiative.statistic": statistic });
    }
    await combat.rollInitiative([combatantId], { skipDialog: true });
  });
}

/** End the active character's turn by advancing the encounter. Only fires when
 *  it is actually that character's turn; Foundry permission-checks the update
 *  server-side, so a player without turn-control permission gets a toast. */
export function endTurn(actorId: string | null): Promise<void> {
  return guard(async () => {
    const combat = activeEncounter();
    if (!combat?.nextTurn) throw new Error("no active encounter");
    if ((combat.combatant?.actor?.id ?? null) !== actorId) return; // not your turn → no-op
    await combat.nextTurn();
  });
}
