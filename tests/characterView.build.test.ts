import { describe, it, expect } from "vitest";
import { buildCharacterView } from "../src/foundry/actor/view";
import { makeCharacterLike } from "./fixtures/characterLike";

describe("buildCharacterView", () => {
  it("composes every section into one view keyed by actor id", () => {
    const v = buildCharacterView(makeCharacterLike());
    expect(v.id).toBe("actor1");
    expect(v.header.name).toBe("Valeros");
    expect(v.defenses.ac).toBe(24);
    expect(v.abilities).toHaveLength(6);
    expect(v.skills.map((s) => s.slug)).toContain("athletics");
    expect(v.conditions).toEqual([]);
    expect(v.effects).toEqual([]);
    expect(v.inventory.categories).toEqual([]);
    expect(v.featGroups).toEqual([]);
    expect(v.bio.className).toBe("Fighter");
    expect(v.traits.size).toBe("Medium");
  });
});
