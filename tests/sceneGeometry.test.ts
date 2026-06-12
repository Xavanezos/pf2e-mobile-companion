import { describe, it, expect } from "vitest";
import { screenToScene, sceneToScreen, type ViewTransform } from "../src/foundry/scene/geometry";

describe("screen/scene transforms", () => {
  const t: ViewTransform = { panX: 40, panY: -25, zoom: 1.5 };

  it("sceneToScreen applies translate + scale", () => {
    expect(sceneToScreen(100, 200, t)).toEqual({ px: 100 * 1.5 + 40, py: 200 * 1.5 - 25 });
  });

  it("screenToScene is the exact inverse of sceneToScreen", () => {
    for (const [x, y] of [[0, 0], [123, 456], [-30, 999]] as const) {
      const s = sceneToScreen(x, y, t);
      const back = screenToScene(s.px, s.py, t);
      expect(back.x).toBeCloseTo(x, 6);
      expect(back.y).toBeCloseTo(y, 6);
    }
  });
});
