import type { CharacterLike } from "../../src/foundry/actor/types";

/** A minimal valid CharacterLike; tests override slices. */
export function makeCharacterLike(over: Partial<CharacterLike> = {}): CharacterLike {
  const base: CharacterLike = {
    id: "actor1",
    name: "Valeros",
    img: "valeros.webp",
    system: {
      details: { level: { value: 5 }, languages: { value: ["common"] }, keyability: { value: "str" },
        biography: { appearance: "", backstory: "" } },
      attributes: {
        hp: { value: 58, temp: 5, max: 72 },
        ac: { value: 24 },
        dying: { value: 0, max: 4 },
        wounded: { value: 1 },
        shield: { itemId: null, ac: 0, hp: { value: 0, max: 0 }, hardness: 0, broken: false, raised: false },
        immunities: [], resistances: [], weaknesses: [],
      },
      saves: {
        fortitude: { value: 13, rank: 2 },
        reflex: { value: 11, rank: 2 },
        will: { value: 9, rank: 1 },
      },
      perception: { value: 12, rank: 2, senses: [{ type: "low-light-vision", label: "Low-Light Vision" }] },
      initiative: { totalModifier: 12, statistic: "perception" },
      movement: { speeds: { land: { value: 25 } } },
      abilities: { str: { mod: 4 }, dex: { mod: 3 }, con: { mod: 3 }, int: { mod: 0 }, wis: { mod: 1 }, cha: { mod: 1 } },
      resources: { heroPoints: { value: 2, max: 3 } },
      proficiencies: { classDCs: { fighter: { value: 24, rank: 2, slug: "fighter", primary: true, label: "Fighter" } },
        attacks: {}, defenses: {} },
      traits: { size: { value: "med" } },
    },
    skills: {
      athletics: { slug: "athletics", label: "Athletics", mod: 13, rank: 2, armor: true },
      acrobatics: { slug: "acrobatics", label: "Acrobatics", mod: 11, rank: 2, armor: true },
    },
    conditions: { active: [] },
    itemTypes: { effect: [], feat: [] },
    inventory: { contents: [], currency: { cp: 0, sp: 0, gp: 0, pp: 0 }, bulk: { value: { normal: 0 }, max: 9, isEncumbered: false } },
    ancestry: { name: "Human" },
    heritage: { name: "Versatile Heritage" },
    background: { name: "Field Medic" },
    class: { name: "Fighter" },
    deity: null,
  };
  return { ...base, ...over } as CharacterLike;
}
