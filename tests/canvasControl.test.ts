import { describe, it, expect, afterEach } from "vitest";
import { nearestDoorIndex, controlToken, type DoorHit } from "../src/foundry/canvas/control";

const door = (x: number, y: number, visible = true): DoorHit => ({ x, y, visible });

/** Canvas-ready stub: the active scene's token docs expose a `.object` placeable
 *  whose `control(options)` call we record (mirrors the targeting test's stub). */
function stubCanvas() {
  const calls: Array<{ id: string; releaseOthers: boolean }> = [];
  const mk = (id: string) => ({
    id,
    object: { id, control: (opts: { releaseOthers?: boolean } = {}) => calls.push({ id, releaseOthers: !!opts.releaseOthers }) },
  });
  const tokens = new Map<string, any>([["a", mk("a")], ["b", mk("b")]]);
  (globalThis as { canvas?: unknown }).canvas = { ready: true, scene: { tokens: { get: (id: string) => tokens.get(id) } } };
  return { calls };
}

afterEach(() => {
  (globalThis as { canvas?: unknown }).canvas = undefined;
});

describe("controlToken", () => {
  it("controls the placeable, releasing others (single-select)", () => {
    const { calls } = stubCanvas();
    controlToken("a");
    expect(calls).toEqual([{ id: "a", releaseOthers: true }]);
  });

  it("no-ops off-canvas (lite mode) without throwing", () => {
    (globalThis as { canvas?: unknown }).canvas = undefined;
    expect(() => controlToken("a")).not.toThrow();
  });

  it("no-ops for a token id that isn't on the scene", () => {
    const { calls } = stubCanvas();
    controlToken("missing");
    expect(calls).toEqual([]);
  });
});

describe("nearestDoorIndex", () => {
  it("returns the nearest door control within the threshold", () => {
    const doors = [door(0, 0), door(100, 100), door(500, 500)];
    expect(nearestDoorIndex({ x: 110, y: 90 }, doors, 50)).toBe(1);
  });
  it("returns -1 when the tap is beyond the threshold of every door", () => {
    expect(nearestDoorIndex({ x: 300, y: 300 }, [door(0, 0), door(600, 600)], 50)).toBe(-1);
  });
  it("ignores hidden door controls", () => {
    const doors = [door(100, 100, false), door(140, 140, true)];
    // The hidden one is closer, but it's skipped; the visible one is in range.
    expect(nearestDoorIndex({ x: 110, y: 110 }, doors, 60)).toBe(1);
  });
  it("returns -1 for no doors", () => {
    expect(nearestDoorIndex({ x: 0, y: 0 }, [], 50)).toBe(-1);
  });
});
