import { describe, it, expect } from "vitest";
import { useAction } from "../src/foundry/actor/actionUse";

interface Call { method: string; args: unknown[]; }

function stub(freq?: { value: number; max: number; per: string }): Call[] {
  const calls: Call[] = [];
  const item = {
    system: { frequency: freq ?? null },
    update: (...args: unknown[]) => { calls.push({ method: "update", args }); return Promise.resolve(); },
    toMessage: (...args: unknown[]) => { calls.push({ method: "toMessage", args }); return Promise.resolve({}); },
  };
  const actor = { items: { get: (id: string) => (id === "i1" ? item : undefined) } };
  (globalThis as { game?: unknown }).game = { actors: { get: () => actor } };
  (globalThis as { ui?: unknown }).ui = { notifications: { error: () => {} } };
  return calls;
}

describe("useAction", () => {
  let calls: Call[];

  it("posts the action card (no frequency → no update)", async () => {
    calls = stub();
    await useAction("a", "i1");
    expect(calls.map((c) => c.method)).toEqual(["toMessage"]);
  });

  it("decrements a limited frequency before posting", async () => {
    calls = stub({ value: 2, max: 3, per: "day" });
    await useAction("a", "i1");
    expect(calls[0]).toEqual({ method: "update", args: [{ "system.frequency.value": 1 }] });
    expect(calls[1].method).toBe("toMessage");
  });

  it("does not decrement an exhausted frequency (value 0) but still posts", async () => {
    calls = stub({ value: 0, max: 1, per: "day" });
    await useAction("a", "i1");
    expect(calls.map((c) => c.method)).toEqual(["toMessage"]);
  });

  it("never throws when the item is gone", async () => {
    calls = stub();
    await expect(useAction("a", "missing")).resolves.toBeUndefined();
    expect(calls).toEqual([]);
  });
});
