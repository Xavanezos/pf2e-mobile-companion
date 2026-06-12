import { describe, it, expect } from "vitest";
import { moveToken } from "../src/foundry/scene/actions";

/** Stub `game.scenes.get(id)` with a scene whose grid snaps to 100px cells.
 *  `reject` makes the token update reject (a permission failure); `noToken`
 *  removes the token. */
function stub(opts: { reject?: boolean; noToken?: boolean } = {}) {
  const calls = { updated: [] as Array<{ x: number; y: number }> };
  const token = {
    update: (p: { x: number; y: number }) => {
      calls.updated.push(p);
      return opts.reject ? Promise.reject(new Error("no perm")) : Promise.resolve(true);
    },
  };
  const scene = {
    grid: { getTopLeftPoint: ({ x, y }: { x: number; y: number }) => ({ x: Math.round(x / 100) * 100, y: Math.round(y / 100) * 100 }) },
    tokens: { get: (_: string) => (opts.noToken ? undefined : token) },
  };
  (globalThis as { game?: unknown }).game = { scenes: { get: (_: string) => scene } };
  (globalThis as { ui?: unknown }).ui = { notifications: { error: () => {} } };
  return calls;
}

describe("moveToken", () => {
  it("snaps to the grid and updates the token", async () => {
    const calls = stub();
    await moveToken("s1", "t1", 138, 271);
    expect(calls.updated).toEqual([{ x: 100, y: 300 }]);
  });

  it("never throws on a rejected (permission) update", async () => {
    stub({ reject: true });
    await expect(moveToken("s1", "t1", 0, 0)).resolves.toBeUndefined();
  });

  it("no-ops when the token is gone", async () => {
    const calls = stub({ noToken: true });
    await moveToken("s1", "t1", 0, 0);
    expect(calls.updated).toEqual([]);
  });
});
