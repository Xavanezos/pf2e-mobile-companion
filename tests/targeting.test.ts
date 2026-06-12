import { describe, it, expect } from "vitest";
import { setTargets, toggleTarget, clearTargets, getTargetIds } from "../src/foundry/scene/targeting";

/** Mimics Foundry's UserTargets (a Set with an `ids` getter). */
class FakeTargets extends Set<{ id: string }> {
  get ids() {
    return [...this].map((t) => t.id);
  }
}

function stub() {
  const calls: { broadcasts: Array<{ sceneId: string | null; targets: string[] }> } = { broadcasts: [] };
  const tokens = new Map<string, any>([
    ["a", { id: "a", actor: { id: "aa" }, parent: { id: "s1" } }],
    ["b", { id: "b", actor: { id: "bb" }, parent: { id: "s1" } }],
  ]);
  const user = {
    targets: new FakeTargets(),
    broadcastActivity: (data: any) => calls.broadcasts.push(data),
  };
  (globalThis as { game?: unknown }).game = {
    user,
    scenes: { active: { id: "s1", tokens: { get: (id: string) => tokens.get(id) } } },
  };
  (globalThis as { ui?: unknown }).ui = { notifications: { error: () => {} } };
  return { calls, user };
}

describe("targeting", () => {
  it("setTargets adds a stand-in and broadcasts with the sceneId handshake", () => {
    const { calls, user } = stub();
    setTargets(["a"]);
    expect(getTargetIds()).toEqual(["a"]);
    expect([...user.targets][0]).toMatchObject({ id: "a", document: { id: "a" }, actor: { id: "aa" } });
    expect(calls.broadcasts.at(-1)).toEqual({ sceneId: "s1", targets: ["a"] });
  });

  it("drops ids that are not on the active scene", () => {
    stub();
    setTargets(["a", "zzz"]);
    expect(getTargetIds()).toEqual(["a"]);
  });

  it("toggleTarget adds then removes (multi-target)", () => {
    stub();
    toggleTarget("a");
    toggleTarget("b");
    expect(getTargetIds().sort()).toEqual(["a", "b"]);
    toggleTarget("a");
    expect(getTargetIds()).toEqual(["b"]);
  });

  it("clearTargets empties locally and broadcasts an empty set", () => {
    const { calls } = stub();
    setTargets(["a", "b"]);
    clearTargets();
    expect(getTargetIds()).toEqual([]);
    expect(calls.broadcasts.at(-1)).toEqual({ sceneId: "s1", targets: [] });
  });
});
