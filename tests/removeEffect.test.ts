import { describe, it, expect, beforeEach } from "vitest";
import { removeEffect } from "../src/foundry/actor/mutations";

function stub(): string[] {
  const calls: string[] = [];
  const effect = {
    delete: () => {
      calls.push("delete");
      return Promise.resolve();
    },
  };
  const actor = { items: { get: (id: string) => (id === "eff1" ? effect : undefined) } };
  (globalThis as { game?: unknown }).game = { actors: { get: () => actor } };
  (globalThis as { ui?: unknown }).ui = { notifications: { error: () => {} } };
  return calls;
}

describe("removeEffect", () => {
  let calls: string[];
  beforeEach(() => {
    calls = stub();
  });

  it("deletes the effect item", async () => {
    await removeEffect("a", "eff1");
    expect(calls).toEqual(["delete"]);
  });

  it("never throws when the effect is missing", async () => {
    await expect(removeEffect("a", "nope")).resolves.toBeUndefined();
    expect(calls).toEqual([]);
  });
});
