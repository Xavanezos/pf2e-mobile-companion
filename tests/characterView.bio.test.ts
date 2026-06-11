import { describe, it, expect } from "vitest";
import { mapBio } from "../src/foundry/actor/view";
import { makeCharacterLike } from "./fixtures/characterLike";

describe("mapBio", () => {
  it("maps lineage, languages, size and proficiency lists", () => {
    const a = makeCharacterLike();
    a.system.proficiencies = {
      ...a.system.proficiencies,
      attacks: { "simple-melee": { label: "Simple", rank: 2, visible: true }, hidden: { label: "Hidden", rank: 0, visible: false } },
      defenses: { unarmored: { label: "Unarmored", rank: 1 } },
    };
    const bio = mapBio(a);
    expect(bio).toMatchObject({ ancestry: "Human", heritage: "Versatile Heritage", background: "Field Medic", className: "Fighter", size: "Medium" });
    expect(bio.deity).toBeUndefined();
    expect(bio.languages).toEqual(["common"]);
    expect(bio.attacks).toEqual([{ label: "Simple", rank: 2 }]); // hidden filtered out
    expect(bio.defenses).toEqual([{ label: "Unarmored", rank: 1 }]);
  });

  it("derives proficiency labels from the record key when PF2e omits them (live shape)", () => {
    const a = makeCharacterLike();
    a.system.proficiencies = {
      ...a.system.proficiencies,
      attacks: { simple: { rank: 2, visible: true }, advanced: { rank: 0 } },
      defenses: { "light-barding": { rank: 1 }, heavy: { rank: 0 } },
    };
    const bio = mapBio(a);
    expect(bio.attacks).toEqual([{ label: "Simple", rank: 2 }, { label: "Advanced", rank: 0 }]);
    expect(bio.defenses).toEqual([{ label: "Light Barding", rank: 1 }, { label: "Heavy", rank: 0 }]);
  });
});
