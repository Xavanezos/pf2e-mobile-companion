import { describe, it, expect } from "vitest";
import { findSpellEffectUuid, buildSpellBaseDamage } from "../src/foundry/spells/chatActions";

describe("findSpellEffectUuid", () => {
  it("extracts a spell-effects UUID from a description", () => {
    const html = '<p>Shield. @UUID[Compendium.pf2e.spell-effects.Item.Spell Effect: Shield]{Effect}</p>';
    expect(findSpellEffectUuid(html)).toBe("Compendium.pf2e.spell-effects.Item.Spell Effect: Shield");
  });
  it("returns null when there is no spell-effects link", () => {
    expect(findSpellEffectUuid("<p>No effect here. @UUID[Compendium.pf2e.conditions.Item.Frightened]</p>")).toBeNull();
    expect(findSpellEffectUuid(undefined)).toBeNull();
    expect(findSpellEffectUuid("")).toBeNull();
  });
});

describe("buildSpellBaseDamage", () => {
  it("joins damage partials as 'formula [category] type'", () => {
    expect(buildSpellBaseDamage({ "0": { formula: "2d4", type: "fire", category: null } })).toBe("2d4 fire");
    expect(
      buildSpellBaseDamage({
        a: { formula: "1d6", type: "fire", category: null },
        b: { formula: "1d6", type: "fire", category: "persistent" },
      }),
    ).toBe("1d6 fire + 1d6 persistent fire");
  });
  it("renders a formula-only partial (no type/category)", () => {
    expect(buildSpellBaseDamage({ "0": { formula: "1d6" } })).toBe("1d6");
  });

  it("returns empty string when there is no damage", () => {
    expect(buildSpellBaseDamage(undefined)).toBe("");
    expect(buildSpellBaseDamage({})).toBe("");
  });
});
