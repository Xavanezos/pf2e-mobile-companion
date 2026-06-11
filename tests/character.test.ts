import { describe, it, expect } from "vitest";
import { resolveCharacter, type MinimalGame, type MinimalActor } from "../src/foundry/character";

function makeGame(characterId: string | null, actors: MinimalActor[]): MinimalGame {
  return {
    user: { character: characterId ? { id: characterId } : null },
    actors: { filter: (p) => actors.filter(p) },
  };
}
const actor = (id: string, over: Partial<MinimalActor> = {}): MinimalActor => ({
  id,
  name: `Actor ${id}`,
  type: "character",
  isOwner: true,
  ...over,
});

describe("resolveCharacter", () => {
  it("defaults to the assigned character", () => {
    const r = resolveCharacter(makeGame("hero", [actor("hero")]));
    expect(r.defaultId).toBe("hero");
    expect(r.candidates.map((c) => c.id)).toEqual(["hero"]);
  });

  it("defaults to the sole owned character when none is assigned", () => {
    const r = resolveCharacter(makeGame(null, [actor("solo")]));
    expect(r.defaultId).toBe("solo");
    expect(r.candidates.map((c) => c.id)).toEqual(["solo"]);
  });

  it("has no default but lists all candidates when several are owned and none assigned", () => {
    const r = resolveCharacter(makeGame(null, [actor("a"), actor("b")]));
    expect(r.defaultId).toBeNull();
    expect(r.candidates.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("keeps every owned PC switchable even when one is assigned", () => {
    const r = resolveCharacter(makeGame("a", [actor("a"), actor("b"), actor("c")]));
    expect(r.defaultId).toBe("a");
    expect(r.candidates.map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  it("ignores non-owned and non-character actors", () => {
    const r = resolveCharacter(
      makeGame(null, [actor("npc", { isOwner: false }), actor("loot", { type: "loot" })]),
    );
    expect(r.defaultId).toBeNull();
    expect(r.candidates).toEqual([]);
  });

  it("returns no default and no candidates when nothing is owned", () => {
    const r = resolveCharacter(makeGame(null, []));
    expect(r.defaultId).toBeNull();
    expect(r.candidates).toEqual([]);
  });
});
