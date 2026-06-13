import { describe, it, expect } from "vitest";
import { nearestDoorIndex, type DoorHit } from "../src/foundry/canvas/control";

const door = (x: number, y: number, visible = true): DoorHit => ({ x, y, visible });

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
