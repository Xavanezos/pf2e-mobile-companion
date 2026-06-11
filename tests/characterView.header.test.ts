import { describe, it, expect } from "vitest";
import { mapHeader } from "../src/foundry/actor/view";
import { makeCharacterLike } from "./fixtures/characterLike";

describe("mapHeader", () => {
  it("projects identity, hero points, hp and the stat strip", () => {
    const h = mapHeader(makeCharacterLike());
    expect(h.name).toBe("Valeros");
    expect(h.level).toBe(5);
    expect(h.ancestryClassLine).toBe("Human Fighter");
    expect(h.heroPoints).toEqual({ value: 2, max: 3 });
    expect(h.hp).toEqual({ value: 58, temp: 5, max: 72 });
    expect(h.dying).toEqual({ value: 0, max: 4 });
    expect(h.wounded).toBe(1);
    expect(h.ac).toBe(24);
    expect(h.perceptionMod).toBe(12);
    expect(h.speed).toBe(25);
  });

  it("collapses a missing ancestry/class to a clean line", () => {
    const h = mapHeader(makeCharacterLike({ ancestry: null, class: { name: "Wizard" } }));
    expect(h.ancestryClassLine).toBe("Wizard");
  });
});
