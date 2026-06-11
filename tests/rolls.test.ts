import { describe, it, expect, beforeEach } from "vitest";
import { rollSkill, rollSave, rollPerception, rollTarget } from "../src/foundry/actor/rolls";

interface Call { stat: string; args: unknown; }

function stub(): Call[] {
  const calls: Call[] = [];
  const make = (stat: string) => ({ roll: (args: unknown) => { calls.push({ stat, args }); return Promise.resolve(); } });
  const actor = {
    skills: { athletics: make("skill:athletics") },
    saves: { reflex: make("save:reflex") },
    perception: make("perception"),
  };
  (globalThis as { game?: unknown }).game = { actors: { get: () => actor } };
  (globalThis as { ui?: unknown }).ui = { notifications: { error: () => {} } };
  return calls;
}

describe("rolls", () => {
  let calls: Call[];
  beforeEach(() => { calls = stub(); });

  it("rolls a skill with the dialog skipped", async () => {
    await rollSkill("a", "athletics");
    expect(calls).toEqual([{ stat: "skill:athletics", args: { skipDialog: true } }]);
  });

  it("rolls a save and perception", async () => {
    await rollSave("a", "reflex");
    await rollPerception("a");
    expect(calls.map((c) => c.stat)).toEqual(["save:reflex", "perception"]);
  });

  it("dispatches by RollTarget kind", async () => {
    await rollTarget("a", { kind: "skill", slug: "athletics" });
    await rollTarget("a", { kind: "save", slug: "reflex" });
    await rollTarget("a", { kind: "perception" });
    expect(calls.map((c) => c.stat)).toEqual(["skill:athletics", "save:reflex", "perception"]);
  });

  it("never throws when the roll rejects", async () => {
    (globalThis as { game?: unknown }).game = {
      actors: { get: () => ({ skills: { athletics: { roll: () => Promise.reject(new Error("boom")) } } }) },
    };
    await expect(rollSkill("a", "athletics")).resolves.toBeUndefined();
  });
});
