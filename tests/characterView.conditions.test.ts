import { describe, it, expect } from "vitest";
import { mapConditions, mapEffects, effectBadgeLabel } from "../src/foundry/actor/view";
import { makeCharacterLike } from "./fixtures/characterLike";

describe("mapConditions", () => {
  it("maps active conditions with value and lock state", () => {
    const a = makeCharacterLike();
    a.conditions.active = [
      { slug: "frightened", name: "Frightened", value: 1, img: "f.svg", isLocked: false },
      { slug: "clumsy", name: "Clumsy", value: 1, img: "c.svg", isLocked: true },
      { slug: "blinded", name: "Blinded", value: null, img: "b.svg" },
    ];
    expect(mapConditions(a)).toEqual([
      { slug: "frightened", name: "Frightened", value: 1, img: "f.svg", locked: false },
      { slug: "clumsy", name: "Clumsy", value: 1, img: "c.svg", locked: true },
      { slug: "blinded", name: "Blinded", value: null, img: "b.svg", locked: false },
    ]);
  });
});

describe("effectBadgeLabel", () => {
  it("prefers explicit label, else stringifies value, else null", () => {
    expect(effectBadgeLabel({ label: "3 rounds" })).toBe("3 rounds");
    expect(effectBadgeLabel({ value: 2 })).toBe("2");
    expect(effectBadgeLabel(null)).toBeNull();
    expect(effectBadgeLabel(undefined)).toBeNull();
  });
});

describe("mapEffects", () => {
  it("maps non-condition effects with a badge label", () => {
    const a = makeCharacterLike();
    a.itemTypes.effect = [{ name: "Bless", img: "bless.svg", badge: { value: 2 } }];
    expect(mapEffects(a)).toEqual([{ name: "Bless", img: "bless.svg", badge: "2" }]);
  });
});
