import { describe, it, expect, beforeEach } from "vitest";
import { setToggle } from "../src/foundry/actor/toggles";

interface Call { args: unknown[]; }

function stub(): Call[] {
  const calls: Call[] = [];
  const actor = { toggleRollOption: (...args: unknown[]) => { calls.push({ args }); return Promise.resolve(true); } };
  (globalThis as { game?: unknown }).game = { actors: { get: () => actor } };
  (globalThis as { ui?: unknown }).ui = { notifications: { error: () => {} } };
  return calls;
}

describe("setToggle", () => {
  let calls: Call[];
  beforeEach(() => { calls = stub(); });

  it("calls actor.toggleRollOption(domain, option, itemId, value)", async () => {
    await setToggle("a", "all", "rage", "i1", true);
    expect(calls[0].args).toEqual(["all", "rage", "i1", true]);
  });

  it("passes null when itemId is empty", async () => {
    await setToggle("a", "all", "rage", "", false);
    expect(calls[0].args).toEqual(["all", "rage", null, false]);
  });

  it("never throws when the actor is gone", async () => {
    (globalThis as { game?: unknown }).game = { actors: { get: () => undefined } };
    await expect(setToggle("a", "all", "rage", "i1", false)).resolves.toBeUndefined();
  });
});
