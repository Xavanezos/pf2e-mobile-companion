import { describe, it, expect } from "vitest";
import { isNearBottom } from "../src/app/chat/scroll";

describe("isNearBottom", () => {
  it("is true at the exact bottom", () => {
    expect(isNearBottom(1000, 800, 200)).toBe(true); // gap 0
  });

  it("is true within the follow threshold", () => {
    expect(isNearBottom(1000, 740, 200)).toBe(true); // gap 60 <= 80
  });

  it("is false once the user scrolls up past the threshold", () => {
    expect(isNearBottom(1000, 200, 200)).toBe(false); // gap 600
  });

  it("treats a feed shorter than its viewport as at-bottom", () => {
    expect(isNearBottom(200, 0, 400)).toBe(true); // nothing to scroll
  });

  it("honors a custom threshold", () => {
    expect(isNearBottom(1000, 700, 200, 50)).toBe(false); // gap 100 > 50
  });
});
