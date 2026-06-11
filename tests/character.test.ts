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
  it("uses the assigned character when present", () => {
    expect(resolveCharacter(makeGame("hero", [actor("hero")]))).toEqual({
      kind: "resolved",
      actorId: "hero",
    });
  });
  it("auto-selects the single owned character", () => {
    expect(resolveCharacter(makeGame(null, [actor("solo")]))).toEqual({
      kind: "resolved",
      actorId: "solo",
    });
  });
  it("returns a picker for multiple owned characters", () => {
    const r = resolveCharacter(makeGame(null, [actor("a"), actor("b")]));
    expect(r.kind).toBe("picker");
    if (r.kind === "picker") expect(r.candidates.map((c) => c.id)).toEqual(["a", "b"]);
  });
  it("ignores non-owned and non-character actors", () => {
    const r = resolveCharacter(
      makeGame(null, [actor("npc", { isOwner: false }), actor("loot", { type: "loot" })]),
    );
    expect(r).toEqual({ kind: "none" });
  });
  it("returns none when nothing is owned", () => {
    expect(resolveCharacter(makeGame(null, []))).toEqual({ kind: "none" });
  });
});
