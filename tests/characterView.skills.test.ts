import { describe, it, expect } from "vitest";
import { mapSkills } from "../src/foundry/actor/view";
import { makeCharacterLike } from "./fixtures/characterLike";

describe("mapSkills", () => {
  it("maps skills sorted alphabetically by label", () => {
    const skills = mapSkills(makeCharacterLike());
    expect(skills.map((s) => s.slug)).toEqual(["acrobatics", "athletics"]);
    expect(skills[1]).toEqual({ slug: "athletics", label: "Athletics", mod: 13, rank: 2, armor: true, lore: false });
  });

  it("flags lore skills and still sorts them in", () => {
    const a = makeCharacterLike();
    a.skills = {
      ...a.skills,
      "warfare-lore": { slug: "warfare-lore", label: "Warfare Lore", mod: 8, rank: 1, armor: false, lore: true },
    };
    const lore = mapSkills(a).find((s) => s.slug === "warfare-lore");
    expect(lore).toEqual({ slug: "warfare-lore", label: "Warfare Lore", mod: 8, rank: 1, armor: false, lore: true });
  });
});
