import { describe, it, expect, afterEach } from "vitest";
import { pickTopTokenAt, pickTokensAt, liveTokenOrigin, type HitToken } from "../src/foundry/canvas/hitTest";

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

describe("pickTokensAt", () => {
  it("returns every overlapping visible token, topmost last", () => {
    // An enemy drawn over my token: both contain the point; my token is reachable
    // as the topmost *mine* even though the enemy is topmost overall.
    const stack = [tok("mine", 100, 100), tok("enemy", 110, 110)];
    expect(pickTokensAt({ x: 150, y: 150 }, stack)).toEqual(["mine", "enemy"]);
  });
  it("omits non-visible tokens and misses", () => {
    const stack = [tok("mine", 100, 100), tok("hidden", 110, 110, false)];
    expect(pickTokensAt({ x: 150, y: 150 }, stack)).toEqual(["mine"]);
    expect(pickTokensAt({ x: 5, y: 5 }, stack)).toEqual([]);
  });
});

describe("liveTokenOrigin", () => {
  afterEach(() => {
    delete (globalThis as { canvas?: unknown }).canvas;
    delete (globalThis as { game?: unknown }).game;
  });

  it("reads the token's CURRENT committed origin off the live placeable", () => {
    // The drag must anchor to where the token actually is now — not a render
    // snapshot that can lag a move behind. After a move the document holds the
    // new cell immediately, so a live read off the placeable returns it.
    (globalThis as { canvas?: unknown }).canvas = {
      tokens: { placeables: [{ id: "t1", document: { x: 300, y: 200 } }] },
    };
    expect(liveTokenOrigin("t1")).toEqual({ left: 300, top: 200 });
  });

  it("falls back to the active scene's token document when there's no placeable", () => {
    (globalThis as { canvas?: unknown }).canvas = { tokens: { placeables: [] } };
    (globalThis as { game?: unknown }).game = {
      scenes: { active: { tokens: { get: (id: string) => (id === "t1" ? { x: 300, y: 200 } : undefined) } } },
    };
    expect(liveTokenOrigin("t1")).toEqual({ left: 300, top: 200 });
  });

  it("returns null off-canvas or for an unknown token (caller falls back to the view)", () => {
    (globalThis as { canvas?: unknown }).canvas = undefined;
    expect(liveTokenOrigin("t1")).toBeNull();
    (globalThis as { canvas?: unknown }).canvas = { tokens: { placeables: [] } };
    (globalThis as { game?: unknown }).game = { scenes: { active: { tokens: { get: () => undefined } } } };
    expect(liveTokenOrigin("ghost")).toBeNull();
  });
});
