import { describe, it, expect } from "vitest";
import { panForDrag, panForFocalZoom, clampScale } from "../src/foundry/canvas/view";

describe("clampScale", () => {
  it("clamps to [min,max]", () => {
    expect(clampScale(10, 0.05, 4)).toBe(4);
    expect(clampScale(0.001, 0.05, 4)).toBe(0.05);
    expect(clampScale(1, 0.05, 4)).toBe(1);
  });
});

describe("panForDrag", () => {
  it("shifts the world center opposite the screen drag, scaled by zoom", () => {
    // drag 100px right at 2x zoom → center moves 50 world units left
    expect(panForDrag(1000, 500, 2, 100, 0)).toEqual({ x: 950, y: 500 });
  });
});

describe("panForFocalZoom", () => {
  it("keeps the focal world point under the focal screen point", () => {
    // world point under the focal stays put: pivot = world - (screen-center)/scale
    const world = { x: 600, y: 400 };
    const screen = { x: 800, y: 600 }; // focal in screen px
    const center = { x: 500, y: 500 }; // window/2
    const pivot = panForFocalZoom(world, screen, center, 2);
    expect(pivot).toEqual({ x: 600 - (800 - 500) / 2, y: 400 - (600 - 500) / 2 });
    // and re-projecting world through (pivot,scale) lands back on screen:
    const projX = (world.x - pivot.x) * 2 + center.x;
    const projY = (world.y - pivot.y) * 2 + center.y;
    expect({ x: projX, y: projY }).toEqual(screen);
  });
});
