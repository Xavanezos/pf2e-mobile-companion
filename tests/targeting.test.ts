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
  (globalThis as { canvas?: unknown }).canvas = undefined; // lite/no-canvas path
  return { calls, user };
}

/** Canvas-ready stub: tokens expose a `.object` placeable whose `setTarget` we record. */
function stubCanvas() {
  const calls: Array<{ id: string; on: boolean }> = [];
  const mk = (id: string) => {
    const object = { id, setTarget: (on: boolean) => calls.push({ id, on }) };
    return { id, object };
  };
  const tokens = new Map<string, any>([["a", mk("a")], ["b", mk("b")]]);
  const user = { targets: new FakeTargets(), broadcastActivity: () => {} };
  (globalThis as { game?: unknown }).game = {
    user,
    scenes: { active: { id: "s1", tokens: { get: (id: string) => tokens.get(id) } } },
  };
  (globalThis as { ui?: unknown }).ui = { notifications: { error: () => {} } };
  (globalThis as { canvas?: unknown }).canvas = { ready: true };
  return { calls, user, tokens };
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

  // Regression for the live crash: with a real canvas, a fake stand-in in
  // game.user.targets kills the native reticle render loop. Canvas mode must use
  // the native Token#setTarget on the real placeable and never add a stand-in.
  it("canvas mode: targets via native setTarget on the placeable, never a stand-in", () => {
    const { calls, user } = stubCanvas();
    setTargets(["a"]);
    expect(calls).toEqual([{ id: "a", on: true }]);
    expect([...user.targets]).toEqual([]); // no fake stand-in added to the set
  });

  it("canvas mode: clearTargets untargets each targeted placeable natively", () => {
    const { calls, user, tokens } = stubCanvas();
    user.targets.add(tokens.get("a").object);
    user.targets.add(tokens.get("b").object);
    calls.length = 0;
    clearTargets();
    expect(calls).toEqual([{ id: "a", on: false }, { id: "b", on: false }]);
  });
});
