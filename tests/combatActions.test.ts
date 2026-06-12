import { describe, it, expect } from "vitest";
import { rollInitiativeWith, endTurn } from "../src/foundry/combat/actions";

/** Stub the Foundry globals. `currentStatistic` is the actor's existing initiative
 *  statistic; `currentActorId` sets whose turn it is (omit → no current combatant);
 *  `rejectNext` makes nextTurn() reject (a permission failure); `noCombat` makes
 *  game.combat null. */
function stub(opts: { currentActorId?: string | null; rejectNext?: boolean; noCombat?: boolean; currentStatistic?: string } = {}) {
  const calls = {
    rolled: [] as Array<{ ids: string[]; options: Record<string, unknown> }>,
    next: 0,
    updates: [] as Record<string, unknown>[],
  };
  const actor = {
    system: { initiative: { statistic: opts.currentStatistic ?? "perception" } },
    update: (data: Record<string, unknown>) => { calls.updates.push(data); return Promise.resolve(true); },
  };
  const combat = {
    combatant: "currentActorId" in opts ? { actor: { id: opts.currentActorId } } : null,
    rollInitiative: (ids: string[], options: Record<string, unknown>) => { calls.rolled.push({ ids, options }); return Promise.resolve(true); },
    nextTurn: () => { calls.next += 1; return opts.rejectNext ? Promise.reject(new Error("no permission")) : Promise.resolve(true); },
  };
  (globalThis as { game?: unknown }).game = { combat: opts.noCombat ? null : combat, actors: { get: () => actor } };
  (globalThis as { ui?: unknown }).ui = { notifications: { error: () => {} } };
  return calls;
}

describe("rollInitiativeWith", () => {
  it("sets the chosen statistic then rolls with skipDialog (no hidden Foundry dialog)", async () => {
    const calls = stub({ currentStatistic: "perception" });
    await rollInitiativeWith("hero", "c1", "athletics");
    expect(calls.updates).toEqual([{ "system.initiative.statistic": "athletics" }]);
    expect(calls.rolled).toHaveLength(1);
    expect(calls.rolled[0].ids).toEqual(["c1"]);
    expect(calls.rolled[0].options).toMatchObject({ skipDialog: true });
  });

  it("skips the actor update when the chosen statistic already matches", async () => {
    const calls = stub({ currentStatistic: "stealth" });
    await rollInitiativeWith("hero", "c1", "stealth");
    expect(calls.updates).toEqual([]);
    expect(calls.rolled).toHaveLength(1);
    expect(calls.rolled[0].options).toMatchObject({ skipDialog: true });
  });

  it("never throws when there is no active encounter", async () => {
    stub({ noCombat: true });
    await expect(rollInitiativeWith("hero", "c1", "perception")).resolves.toBeUndefined();
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
