import { describe, it, expect } from "vitest";
import { mapDefenses, mapAbilities, mapTraits, initiativeOptions } from "../src/foundry/actor/view";
import { makeCharacterLike } from "./fixtures/characterLike";

describe("initiativeOptions", () => {
  it("is perception followed by each skill slug", () => {
    const opts = initiativeOptions(makeCharacterLike());
    expect(opts[0]).toEqual({ value: "perception", label: "Perception" });
    expect(opts.map((o) => o.value)).toEqual(["perception", "athletics", "acrobatics"]);
  });
});

describe("mapDefenses", () => {
  it("maps saves, perception, initiative, ac, class DCs and speeds", () => {
    const d = mapDefenses(makeCharacterLike());
    expect(d.ac).toBe(24);
    expect(d.saves).toEqual([
      { slug: "fortitude", label: "Fortitude", mod: 13, rank: 2 },
      { slug: "reflex", label: "Reflex", mod: 11, rank: 2 },
      { slug: "will", label: "Will", mod: 9, rank: 1 },
    ]);
    expect(d.perception).toEqual({ mod: 12, rank: 2, senses: [{ label: "Low-Light Vision" }] });
    expect(d.initiative.mod).toBe(12);
    expect(d.initiative.statistic).toBe("perception");
    expect(d.classDCs).toEqual([{ slug: "fighter", label: "Fighter", value: 24, rank: 2, primary: true }]);
    expect(d.speeds).toEqual([{ type: "land", label: "Land", value: 25 }]);
    expect(d.shield).toBeUndefined();
  });

  it("includes a shield only when one is equipped (itemId set)", () => {
    const a = makeCharacterLike();
    a.system.attributes.shield = { itemId: "sh1", ac: 2, hp: { value: 12, max: 12 }, hardness: 5, broken: false, raised: true };
    const d = mapDefenses(a);
    expect(d.shield).toEqual({ ac: 2, hp: { value: 12, max: 12 }, hardness: 5, broken: false, raised: true });
  });

  it("lists every present movement speed", () => {
    const a = makeCharacterLike();
    a.system.movement = { speeds: { land: { value: 25 }, fly: { value: 30 }, swim: undefined } };
    expect(mapDefenses(a).speeds).toEqual([
      { type: "land", label: "Land", value: 25 },
      { type: "fly", label: "Fly", value: 30 },
    ]);
  });
});

describe("mapAbilities", () => {
  it("maps six modifiers and marks the key ability", () => {
    const abilities = mapAbilities(makeCharacterLike());
    expect(abilities).toHaveLength(6);
    expect(abilities[0]).toEqual({ slug: "str", label: "STR", mod: 4, key: true });
    expect(abilities.find((x) => x.slug === "dex")).toEqual({ slug: "dex", label: "DEX", mod: 3, key: false });
  });
});

describe("mapTraits", () => {
  it("maps size and IWR labels, omitting empties", () => {
    const a = makeCharacterLike();
    a.system.attributes.resistances = [{ label: "Fire 5", value: 5 }];
    a.system.attributes.weaknesses = [{ label: "Cold 5", value: 5 }];
    a.system.attributes.immunities = [{ label: "Disease" }];
    const t = mapTraits(a);
    expect(t.size).toBe("Medium");
    expect(t.resistances).toEqual([{ label: "Fire 5" }]);
    expect(t.weaknesses).toEqual([{ label: "Cold 5" }]);
    expect(t.immunities).toEqual([{ label: "Disease" }]);
  });
});
