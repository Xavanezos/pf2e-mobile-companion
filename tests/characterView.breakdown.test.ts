import { describe, it, expect } from "vitest";
import { mapDefenses, mapSkills } from "../src/foundry/actor/view";
import { makeCharacterLike } from "./fixtures/characterLike";

describe("modifier breakdowns (#5)", () => {
  it("extracts enabled modifiers for AC, saves, perception and class DC", () => {
    const a = makeCharacterLike();
    a.system.attributes.ac.modifiers = [
      { label: "Untrained", modifier: 0 },
      { label: "Dex", modifier: 4 },
      { label: "Item", modifier: 1, enabled: true },
      { label: "Off-Guard", modifier: -2, enabled: false }, // disabled → excluded
    ];
    a.system.saves.fortitude.modifiers = [{ label: "Proficiency", modifier: 11 }, { label: "Con", modifier: 2 }];
    a.system.perception.modifiers = [{ label: "Proficiency", modifier: 10 }, { label: "Wis", modifier: 2 }];
    a.system.proficiencies!.classDCs!.fighter.modifiers = [{ label: "Str", modifier: 4 }];

    const d = mapDefenses(a);
    expect(d.acBreakdown).toEqual([
      { label: "Untrained", value: 0 },
      { label: "Dex", value: 4 },
      { label: "Item", value: 1 },
    ]);
    expect(d.saves[0].breakdown).toEqual([{ label: "Proficiency", value: 11 }, { label: "Con", value: 2 }]);
    expect(d.perception.breakdown).toEqual([{ label: "Proficiency", value: 10 }, { label: "Wis", value: 2 }]);
    expect(d.classDCs[0].breakdown).toEqual([{ label: "Str", value: 4 }]);
  });

  it("reads skill modifiers from either `.modifiers` or `.check.modifiers`", () => {
    const a = makeCharacterLike();
    a.skills.athletics.modifiers = [{ label: "Str", modifier: 4 }, { label: "Proficiency", modifier: 9 }];
    a.skills.acrobatics.check = { modifiers: [{ label: "Dex", modifier: 3 }] };

    const skills = mapSkills(a);
    expect(skills.find((s) => s.slug === "athletics")!.breakdown).toEqual([
      { label: "Str", value: 4 },
      { label: "Proficiency", value: 9 },
    ]);
    expect(skills.find((s) => s.slug === "acrobatics")!.breakdown).toEqual([{ label: "Dex", value: 3 }]);
  });

  it("omits the breakdown field entirely when no modifiers are present", () => {
    const d = mapDefenses(makeCharacterLike());
    expect(d.acBreakdown).toBeUndefined();
    expect(d.saves[0].breakdown).toBeUndefined();
    expect(mapSkills(makeCharacterLike())[0].breakdown).toBeUndefined();
  });
});
