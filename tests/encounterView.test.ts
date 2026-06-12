import { describe, it, expect } from "vitest";
import { buildEncounterView } from "../src/foundry/combat/view";
import type { CombatantLike, EncounterLike, EncounterViewContext } from "../src/foundry/combat/types";

/** A combatant fixture with sensible defaults; override per case. Note: passing
 *  `actor` or `token` REPLACES the default object (no deep merge). */
function combatant(over: Partial<CombatantLike> = {}): CombatantLike {
  return {
    id: "c1",
    name: "Goblin",
    initiative: 10,
    hidden: false,
    defeated: false,
    playersCanSeeName: true,
    img: null,
    token: null,
    actor: { id: "a1", img: null, hasPlayerOwner: false, system: { attributes: { hp: { value: 5, max: 5 } } } },
    ...over,
  };
}

function encounter(turns: CombatantLike[], over: Partial<EncounterLike> = {}): EncounterLike {
  return { round: 1, started: true, combatant: null, turns, ...over };
}

const PLAYER: EncounterViewContext = { isGM: false, characterActorId: "hero" };
const GM: EncounterViewContext = { isGM: true, characterActorId: null };

describe("buildEncounterView", () => {
  it("preserves turn order and maps the basic fields", () => {
    const view = buildEncounterView(
      encounter([
        combatant({ id: "c1", name: "Ezren", initiative: 22 }),
        combatant({ id: "c2", name: "Goblin", initiative: 15 }),
      ]),
      GM,
    );
    expect(view.combatants.map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(view.combatants[0]).toMatchObject({ name: "Ezren", initiative: 22 });
    expect(view.round).toBe(1);
    expect(view.started).toBe(true);
  });

  it("omits GM-hidden combatants for a player but keeps them for the GM", () => {
    const turns = [combatant({ id: "vis" }), combatant({ id: "secret", hidden: true })];
    expect(buildEncounterView(encounter(turns), PLAYER).combatants.map((c) => c.id)).toEqual(["vis"]);
    expect(buildEncounterView(encounter(turns), GM).combatants.map((c) => c.id)).toEqual(["vis", "secret"]);
  });

  it("blanks the name to 'Unknown' when the player may not see it", () => {
    const hidden = [combatant({ id: "c1", name: "Dragon", playersCanSeeName: false })];
    expect(buildEncounterView(encounter(hidden), PLAYER).combatants[0].name).toBe("Unknown");
    expect(buildEncounterView(encounter(hidden), GM).combatants[0].name).toBe("Dragon"); // GM sees real name
    const shown = [combatant({ name: "Bob", playersCanSeeName: true })];
    expect(buildEncounterView(encounter(shown), PLAYER).combatants[0].name).toBe("Bob");
  });

  it("resolves the portrait via token.texture.src → actor.img → combatant.img → null", () => {
    const tok = combatant({ id: "t", token: { texture: { src: "tok.webp" } }, actor: { id: "a", img: "act.webp" } });
    const act = combatant({ id: "a", token: null, actor: { id: "a", img: "act.webp" } });
    const cmb = combatant({ id: "c", token: null, actor: null, img: "cmb.webp" });
    const none = combatant({ id: "n", token: null, actor: null, img: null });
    const view = buildEncounterView(encounter([tok, act, cmb, none]), GM);
    expect(view.combatants.map((c) => c.img)).toEqual(["tok.webp", "act.webp", "cmb.webp", null]);
  });

  it("shows HP only where the viewer may see it (own/party for players, all for GM)", () => {
    const pc = combatant({ id: "pc", actor: { id: "hero", hasPlayerOwner: true, system: { attributes: { hp: { value: 30, max: 40 } } } } });
    const npc = combatant({ id: "npc", actor: { id: "x", hasPlayerOwner: false, system: { attributes: { hp: { value: 8, max: 8 } } } } });
    const playerView = buildEncounterView(encounter([pc, npc]), PLAYER);
    expect(playerView.combatants[0].hp).toEqual({ value: 30, max: 40 }); // own/party PC visible
    expect(playerView.combatants[1].hp).toBeNull();                       // NPC hidden from player
    expect(buildEncounterView(encounter([pc, npc]), GM).combatants[1].hp).toEqual({ value: 8, max: 8 }); // GM sees all
  });

  it("returns null HP when the hp shape is missing", () => {
    const c = combatant({ actor: { id: "a", hasPlayerOwner: true, system: {} } });
    expect(buildEncounterView(encounter([c]), GM).combatants[0].hp).toBeNull();
  });

  it("flags the current combatant and the active character's own combatant", () => {
    const turns = [
      combatant({ id: "c1", actor: { id: "hero", hasPlayerOwner: true } }),
      combatant({ id: "c2", actor: { id: "foe" } }),
    ];
    const view = buildEncounterView(encounter(turns, { combatant: { id: "c1" } }), PLAYER);
    expect(view.combatants[0]).toMatchObject({ isCurrent: true, isMine: true });
    expect(view.combatants[1]).toMatchObject({ isCurrent: false, isMine: false });
    expect(view.myCombatantId).toBe("c1");
    expect(view.isMyTurn).toBe(true);
  });

  it("canRollInitiative is true only when my combatant exists and has no initiative", () => {
    const mineUnrolled = encounter([combatant({ id: "c1", initiative: null, actor: { id: "hero", hasPlayerOwner: true } })]);
    expect(buildEncounterView(mineUnrolled, PLAYER).canRollInitiative).toBe(true);
    const mineRolled = encounter([combatant({ id: "c1", initiative: 18, actor: { id: "hero", hasPlayerOwner: true } })]);
    expect(buildEncounterView(mineRolled, PLAYER).canRollInitiative).toBe(false);
    const notMine = encounter([combatant({ id: "c1", initiative: null, actor: { id: "foe" } })]);
    expect(buildEncounterView(notMine, PLAYER).canRollInitiative).toBe(false);
  });

  it("handles an empty encounter", () => {
    const view = buildEncounterView(encounter([]), PLAYER);
    expect(view.combatants).toEqual([]);
    expect(view.myCombatantId).toBeNull();
    expect(view.canRollInitiative).toBe(false);
    expect(view.isMyTurn).toBe(false);
  });
});
