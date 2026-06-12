import { describe, it, expect } from "vitest";
import { rollInitiative, endTurn } from "../src/foundry/combat/actions";

/** Stub the Foundry globals with a live combat. `currentActorId` sets whose turn
 *  it is (omit → no current combatant); `rejectNext` makes nextTurn() reject (a
 *  permission failure); `noCombat` makes game.combat null. */
function stub(opts: { currentActorId?: string | null; rejectNext?: boolean; noCombat?: boolean } = {}) {
  const calls = { rolled: [] as string[][], next: 0 };
  const combat = {
    combatant: "currentActorId" in opts ? { actor: { id: opts.currentActorId } } : null,
    rollInitiative: (ids: string[]) => { calls.rolled.push(ids); return Promise.resolve(true); },
    nextTurn: () => { calls.next += 1; return opts.rejectNext ? Promise.reject(new Error("no permission")) : Promise.resolve(true); },
  };
  (globalThis as { game?: unknown }).game = { combat: opts.noCombat ? null : combat };
  (globalThis as { ui?: unknown }).ui = { notifications: { error: () => {} } };
  return calls;
}

describe("rollInitiative", () => {
  it("calls combat.rollInitiative with the combatant id", async () => {
    const calls = stub();
    await rollInitiative("c1");
    expect(calls.rolled).toEqual([["c1"]]);
  });
  it("never throws when there is no active encounter", async () => {
    stub({ noCombat: true });
    await expect(rollInitiative("c1")).resolves.toBeUndefined();
  });
});

describe("endTurn", () => {
  it("advances the turn when it is the actor's turn", async () => {
    const calls = stub({ currentActorId: "hero" });
    await endTurn("hero");
    expect(calls.next).toBe(1);
  });
  it("does nothing when it is not the actor's turn", async () => {
    const calls = stub({ currentActorId: "foe" });
    await endTurn("hero");
    expect(calls.next).toBe(0);
  });
  it("swallows a permission rejection (toast, no throw)", async () => {
    stub({ currentActorId: "hero", rejectNext: true });
    await expect(endTurn("hero")).resolves.toBeUndefined();
  });
});
