import { describe, it, expect } from "vitest";
import { mapFeats, actionGlyph } from "../src/foundry/actor/view";
import { makeCharacterLike } from "./fixtures/characterLike";
import type { FeatLike } from "../src/foundry/actor/types";

const feat = (over: Partial<FeatLike> & { id: string; name: string; category: string }): FeatLike => ({
  id: over.id, name: over.name,
  system: { category: over.category, level: over.system?.level ?? { value: 1 },
    actionType: over.system?.actionType, actions: over.system?.actions, traits: over.system?.traits ?? { value: [] } },
});

describe("actionGlyph", () => {
  it("maps action economy to a glyph code", () => {
    expect(actionGlyph({ value: "action" }, { value: 1 })).toBe("1");
    expect(actionGlyph({ value: "action" }, { value: 2 })).toBe("2");
    expect(actionGlyph({ value: "reaction" }, { value: null })).toBe("reaction");
    expect(actionGlyph({ value: "free" }, { value: null })).toBe("free");
    expect(actionGlyph({ value: "passive" }, { value: null })).toBeNull();
    expect(actionGlyph(undefined, undefined)).toBeNull();
  });
});

describe("mapFeats", () => {
  it("groups feats by category in display order, sorted by level", () => {
    const a = makeCharacterLike();
    a.itemTypes.feat = [
      feat({ id: "c2", name: "Sudden Charge", category: "class", system: { category: "class", level: { value: 1 }, actionType: { value: "action" }, actions: { value: 2 }, traits: { value: ["flourish"] } } }),
      feat({ id: "an1", name: "Natural Ambition", category: "ancestry", system: { category: "ancestry", level: { value: 1 } } }),
      feat({ id: "cf1", name: "Attack of Opportunity", category: "classfeature", system: { category: "classfeature", level: { value: 1 }, actionType: { value: "reaction" }, actions: { value: null } } }),
      feat({ id: "c5", name: "Power Attack", category: "class", system: { category: "class", level: { value: 5 } } }),
    ];
    const groups = mapFeats(a);
    expect(groups.map((g) => g.key)).toEqual(["ancestry", "class", "classfeature"]);
    const cls = groups.find((g) => g.key === "class")!;
    expect(cls.label).toBe("Class Feats");
    expect(cls.feats.map((f) => f.name)).toEqual(["Sudden Charge", "Power Attack"]);
    expect(cls.feats[0]).toEqual({ id: "c2", name: "Sudden Charge", img: undefined, actionGlyph: "2", traits: ["flourish"], level: 1 });
  });

  it("omits empty groups", () => {
    expect(mapFeats(makeCharacterLike())).toEqual([]);
  });
});
