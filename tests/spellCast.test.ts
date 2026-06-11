import { describe, it, expect, beforeEach } from "vitest";
import { castSpell, castRitual, consumeActivation } from "../src/foundry/spells/cast";

interface Call {
  method: string;
  args: unknown[];
}

function stub(): Call[] {
  const calls: Call[] = [];
  const spell = { id: "sp1" };
  const ritualSpell = { id: "r1" };
  const entry = {
    spells: { get: (id: string) => (id === "sp1" ? spell : null) },
    cast: (...args: unknown[]) => {
      calls.push({ method: "cast", args });
      return Promise.resolve();
    },
  };
  const ritual = {
    spells: { get: (id: string) => (id === "r1" ? ritualSpell : null) },
    cast: (...args: unknown[]) => {
      calls.push({ method: "ritual.cast", args });
      return Promise.resolve();
    },
  };
  const wand = {
    consume: (...args: unknown[]) => {
      calls.push({ method: "consume", args });
      return Promise.resolve();
    },
  };
  const actor = {
    spellcasting: { get: (id: string) => (id === "entry1" ? entry : undefined), ritual },
    items: { get: (id: string) => (id === "wand1" ? wand : null) },
  };
  (globalThis as { game?: unknown }).game = { actors: { get: () => actor } };
  (globalThis as { ui?: unknown }).ui = { notifications: { error: () => {} } };
  return calls;
}

describe("spell cast", () => {
  let calls: Call[];
  beforeEach(() => {
    calls = stub();
  });

  it("casts a spell via its entry, forwarding rank + slotId", async () => {
    await castSpell("a", "entry1", "sp1", { rank: 2, slotId: 1 });
    expect(calls).toEqual([{ method: "cast", args: [{ id: "sp1" }, { rank: 2, slotId: 1 }] }]);
  });

  it("omits slotId/rank when not given (at-will / spontaneous)", async () => {
    await castSpell("a", "entry1", "sp1", {});
    expect(calls).toEqual([{ method: "cast", args: [{ id: "sp1" }, {}] }]);
  });

  it("casts a ritual via the ritual entry", async () => {
    await castRitual("a", "r1");
    expect(calls[0].method).toBe("ritual.cast");
  });

  it("consumes an activation item", async () => {
    await consumeActivation("a", "wand1");
    expect(calls[0].method).toBe("consume");
  });

  it("never throws when the cast rejects", async () => {
    (globalThis as { game?: unknown }).game = {
      actors: {
        get: () => ({
          spellcasting: { get: () => ({ spells: { get: () => ({ id: "x" }) }, cast: () => Promise.reject(new Error("boom")) }) },
        }),
      },
    };
    await expect(castSpell("a", "e", "x", {})).resolves.toBeUndefined();
  });
});
