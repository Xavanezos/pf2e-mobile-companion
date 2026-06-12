import { describe, it, expect } from "vitest";
import {
  findSpellEffectUuid,
  buildSpellBaseDamage,
  rollSpellDamage,
  rollSpellSave,
  applySpellEffect,
} from "../src/foundry/spells/chatActions";

describe("findSpellEffectUuid", () => {
  it("extracts a spell-effects UUID from a description", () => {
    const html = '<p>Shield. @UUID[Compendium.pf2e.spell-effects.Item.Spell Effect: Shield]{Effect}</p>';
    expect(findSpellEffectUuid(html)).toBe("Compendium.pf2e.spell-effects.Item.Spell Effect: Shield");
  });
  it("returns null when there is no spell-effects link", () => {
    expect(findSpellEffectUuid("<p>No effect here. @UUID[Compendium.pf2e.conditions.Item.Frightened]</p>")).toBeNull();
    expect(findSpellEffectUuid(undefined)).toBeNull();
    expect(findSpellEffectUuid("")).toBeNull();
  });
});

describe("buildSpellBaseDamage", () => {
  it("joins damage partials as 'formula [category] type'", () => {
    expect(buildSpellBaseDamage({ "0": { formula: "2d4", type: "fire", category: null } })).toBe("2d4 fire");
    expect(
      buildSpellBaseDamage({
        a: { formula: "1d6", type: "fire", category: null },
        b: { formula: "1d6", type: "fire", category: "persistent" },
      }),
    ).toBe("1d6 fire + 1d6 persistent fire");
  });
  it("renders a formula-only partial (no type/category)", () => {
    expect(buildSpellBaseDamage({ "0": { formula: "1d6" } })).toBe("1d6");
  });

  it("returns empty string when there is no damage", () => {
    expect(buildSpellBaseDamage(undefined)).toBe("");
    expect(buildSpellBaseDamage({})).toBe("");
  });
});

interface Call { method: string; args: unknown[] }

function stub() {
  const calls: Call[] = [];
  const spell = {
    name: "Breathe Fire",
    rollDamage: (...args: unknown[]) => { calls.push({ method: "rollDamage", args }); return Promise.resolve(); },
  };
  const reflex = {
    roll: (...args: unknown[]) => { calls.push({ method: "save.roll", args }); return Promise.resolve(); },
  };
  const message = { item: spell, actor: { id: "caster" } };
  const actor = { saves: { reflex }, createEmbeddedDocuments: (...args: unknown[]) => { calls.push({ method: "createEmbeddedDocuments", args }); return Promise.resolve([]); } };
  (globalThis as { game?: unknown }).game = {
    messages: { get: (id: string) => (id === "m1" ? message : null) },
    actors: { get: (id: string) => (id === "a1" ? actor : null) },
  };
  (globalThis as { ui?: unknown }).ui = { notifications: { error: () => {} } };
  (globalThis as { fromUuid?: unknown }).fromUuid = (uuid: string) =>
    Promise.resolve(uuid.includes("spell-effects") ? { toObject: () => ({ _id: "orig", type: "effect" }) } : null);
  (globalThis as { PointerEvent?: unknown }).PointerEvent ??= class { constructor(public type: string) {} } as unknown;
  return { calls };
}

describe("rollSpellDamage", () => {
  it("calls rollDamage on the message's cast spell with a click event", async () => {
    const { calls } = stub();
    await rollSpellDamage("m1");
    expect(calls[0].method).toBe("rollDamage");
    expect((calls[0].args[0] as { type?: string }).type).toBe("click");
  });
  it("never throws when there is no spell on the message", async () => {
    stub();
    await expect(rollSpellDamage("missing")).resolves.toBeUndefined();
  });
});

describe("rollSpellSave", () => {
  it("rolls the bound actor's save with DC + rollTwice, forwarding item/origin", async () => {
    const { calls } = stub();
    await rollSpellSave("a1", "reflex", 18, { mode: "fortune", messageId: "m1" });
    expect(calls[0].method).toBe("save.roll");
    const arg = calls[0].args[0] as Record<string, unknown>;
    expect(arg.dc).toEqual({ value: 18 });
    expect(arg.rollTwice).toBe("keep-higher");
    expect(arg.skipDialog).toBe(true);
    expect(arg.origin).toEqual({ id: "caster" });
    expect(arg.item).toBeTruthy();
  });
  it("never throws for an unknown save type", async () => {
    stub();
    await expect(rollSpellSave("a1", "bogus", 10, {})).resolves.toBeUndefined();
  });
});

describe("applySpellEffect", () => {
  it("creates the effect item on the bound actor (id stripped)", async () => {
    const { calls } = stub();
    await applySpellEffect("a1", "Compendium.pf2e.spell-effects.Item.Spell Effect: Shield");
    expect(calls[0].method).toBe("createEmbeddedDocuments");
    const [docType, sources] = calls[0].args as [string, Array<{ _id: unknown }>];
    expect(docType).toBe("Item");
    expect(sources[0]._id).toBeNull();
  });
  it("never throws when the effect can't be resolved", async () => {
    stub();
    await expect(applySpellEffect("a1", "Compendium.pf2e.other.Item.Nope")).resolves.toBeUndefined();
  });
});
