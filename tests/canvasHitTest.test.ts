import { describe, it, expect } from "vitest";
import { pickTopTokenAt, type HitToken } from "../src/foundry/canvas/hitTest";

const tok = (id: string, x: number, y: number, visible = true): HitToken =>
  ({ id, left: x, top: y, right: x + 100, bottom: y + 100, visible });

describe("pickTopTokenAt", () => {
  it("returns the token whose box contains the point", () => {
    expect(pickTopTokenAt({ x: 150, y: 150 }, [tok("a", 100, 100)])).toBe("a");
  });
  it("returns null on a miss", () => {
    expect(pickTopTokenAt({ x: 5, y: 5 }, [tok("a", 100, 100)])).toBeNull();
  });
  it("skips non-visible tokens (fog/vision)", () => {
    expect(pickTopTokenAt({ x: 150, y: 150 }, [tok("a", 100, 100, false)])).toBeNull();
  });
  it("topmost (later in array) wins overlaps", () => {
    expect(pickTopTokenAt({ x: 150, y: 150 }, [tok("under", 100, 100), tok("over", 120, 120)])).toBe("over");
  });
});
