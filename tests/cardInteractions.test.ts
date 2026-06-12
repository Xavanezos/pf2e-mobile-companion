import { describe, it, expect } from "vitest";
import { interactionFromControl } from "../src/foundry/chat/cardInteractions";

describe("interactionFromControl", () => {
  it("maps a spell-damage button to a damage interaction", () => {
    expect(interactionFromControl({ action: "spell-damage", save: null, dc: null, uuid: null }, "m1"))
      .toEqual({ kind: "damage", messageId: "m1" });
  });

  it("maps a spell-save button (with type + dc) to a save interaction", () => {
    expect(interactionFromControl({ action: "spell-save", save: "reflex", dc: "18", uuid: null }, "m1"))
      .toEqual({ kind: "save", messageId: "m1", saveType: "reflex", dc: 18 });
  });

  it("ignores a save button with a non-numeric, empty, or zero dc", () => {
    expect(interactionFromControl({ action: "spell-save", save: "reflex", dc: "NaN", uuid: null }, "m1")).toBeNull();
    expect(interactionFromControl({ action: "spell-save", save: "reflex", dc: "", uuid: null }, "m1")).toBeNull();
    expect(interactionFromControl({ action: "spell-save", save: "reflex", dc: "0", uuid: null }, "m1")).toBeNull();
  });

  it("maps a spell-effects content link to an effect interaction", () => {
    const uuid = "Compendium.pf2e.spell-effects.Item.Spell Effect: Shield";
    expect(interactionFromControl({ action: null, save: null, dc: null, uuid }, "m1"))
      .toEqual({ kind: "effect", uuid });
  });

  it("ignores a non-spell-effects link and unrelated controls", () => {
    expect(interactionFromControl({ action: null, save: null, dc: null, uuid: "Actor.abc" }, "m1")).toBeNull();
    expect(interactionFromControl({ action: "other", save: null, dc: null, uuid: null }, "m1")).toBeNull();
  });

  it("maps a strike-damage button (success) to a non-critical strike-damage interaction", () => {
    expect(interactionFromControl({ action: "strike-damage", save: null, dc: null, uuid: null, outcome: "success" }, "m1"))
      .toEqual({ kind: "strike-damage", messageId: "m1", critical: false });
  });

  it("maps a strike-damage button (critical-success) to a critical strike-damage interaction", () => {
    // PF2e's real card markup uses kebab-case data-outcome="critical-success" (not camelCase).
    expect(interactionFromControl({ action: "strike-damage", save: null, dc: null, uuid: null, outcome: "critical-success" }, "m1"))
      .toEqual({ kind: "strike-damage", messageId: "m1", critical: true });
  });

  it("treats any non-success strike-damage outcome (incl. missing) as critical, mirroring PF2e", () => {
    // PF2e: `outcome === "success" ? "damage" : "critical"` (cards.ts) — default to critical.
    expect(interactionFromControl({ action: "strike-damage", save: null, dc: null, uuid: null, outcome: null }, "m1"))
      .toEqual({ kind: "strike-damage", messageId: "m1", critical: true });
  });
});
