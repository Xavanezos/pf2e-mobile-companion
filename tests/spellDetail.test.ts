import { describe, it, expect } from "vitest";
import { buildSpellDetail } from "../src/foundry/spells/view";

describe("buildSpellDetail", () => {
  it("extracts rank, traits (rarity+traditions+traits), meta, glyph, description", () => {
    const d = buildSpellDetail({
      name: "Fireball",
      img: "f.webp",
      system: {
        level: { value: 3 },
        traits: { value: ["fire"], rarity: "common", traditions: ["arcane", "primal"] },
        time: { value: "2" },
        range: { value: "500 feet" },
        area: { type: "burst", value: 20 },
        duration: { value: "" },
        defense: { save: { statistic: "reflex", basic: true } },
        description: { value: "<p>Boom</p>" },
      },
    });
    expect(d).toMatchObject({ name: "Fireball", rank: 3, glyph: "2" });
    expect(d.traits).toEqual(["arcane", "primal", "fire"]); // common rarity dropped
    expect(d.meta).toEqual([
      { label: "Cast", value: "2" },
      { label: "Range", value: "500 feet" },
      { label: "Area", value: "20-foot burst" },
      { label: "Defense", value: "basic reflex" },
    ]);
    expect(d.descriptionHtml).toBe("<p>Boom</p>");
  });

  it("defaults gracefully on a sparse spell", () => {
    const d = buildSpellDetail({ name: "Prestidigitation" });
    expect(d).toMatchObject({ name: "Prestidigitation", rank: 1, glyph: null, traits: [], meta: [], descriptionHtml: "" });
  });
});
