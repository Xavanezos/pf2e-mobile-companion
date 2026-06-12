/** Guarded combat dispatches. Thin glue over the live `game.combat`; a rejected
 *  call (e.g. a player lacking turn-control permission) surfaces via Foundry's
 *  toast and never throws into React — same contract as `rolls.ts`/`hotbar.ts`. */

interface LiveEncounter {
  combatant?: { actor?: { id?: string } | null } | null;
  rollInitiative?(ids: string[]): Promise<unknown>;
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

/** Roll a combatant's initiative — PF2e rolls the actor's chosen statistic
 *  (perception or a skill) and updates the tracker, exactly like the stock
 *  tracker's roll button. */
export function rollInitiative(combatantId: string): Promise<void> {
  return guard(async () => {
    const combat = activeEncounter();
    if (!combat?.rollInitiative) throw new Error("no active encounter");
    await combat.rollInitiative([combatantId]);
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
