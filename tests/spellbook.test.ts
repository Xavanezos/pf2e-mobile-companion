import { describe, it, expect, beforeEach } from "vitest";
import { prepareSpell, unprepareSpell, removeKnownSpell, toggleSignature, setFocusPoints } from "../src/foundry/spells/spellbook";
import { buildSpellbookView } from "../src/foundry/spells/view";
import type { SpellcastingSheetDataLike } from "../src/foundry/spells/types";

interface Call {
  method: string;
  args: unknown[];
}

function stub(): Call[] {
  const calls: Call[] = [];
  const spell = {
    id: "sp1",
    system: { location: { signature: false } },
    update: (d: unknown) => {
      calls.push({ method: "spell.update", args: [d] });
      return Promise.resolve();
    },
    delete: () => {
      calls.push({ method: "spell.delete", args: [] });
      return Promise.resolve();
    },
  };
  const coll = {
    get: (id: string) => (id === "sp1" ? spell : null),
    prepareSpell: (...a: unknown[]) => {
      calls.push({ method: "prepareSpell", args: a });
      return Promise.resolve();
    },
  };
  const actor = {
    spellcasting: { get: (id: string) => (id === "e1" ? { spells: coll } : undefined) },
    items: { get: (id: string) => (id === "sp1" ? spell : null) },
    update: (d: unknown) => {
      calls.push({ method: "actor.update", args: [d] });
      return Promise.resolve();
    },
  };
  (globalThis as { game?: unknown }).game = { actors: { get: () => actor } };
  (globalThis as { ui?: unknown }).ui = { notifications: { error: () => {} } };
  return calls;
}

describe("spellbook mutations", () => {
  let calls: Call[];
  beforeEach(() => {
    calls = stub();
  });

  it("prepares a spell into a slot", async () => {
    await prepareSpell("a", "e1", "sp1", "1", 0);
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("prepareSpell");
    expect((calls[0].args[0] as { id: string }).id).toBe("sp1");
    expect(calls[0].args[1]).toBe("1");
    expect(calls[0].args[2]).toBe(0);
  });

  it("clears a slot via prepareSpell(null)", async () => {
    await unprepareSpell("a", "e1", "1", 0);
    expect(calls).toEqual([{ method: "prepareSpell", args: [null, "1", 0] }]);
  });

  it("removes a known spell", async () => {
    await removeKnownSpell("a", "sp1");
    expect(calls).toEqual([{ method: "spell.delete", args: [] }]);
  });

  it("toggles the signature flag", async () => {
    await toggleSignature("a", "sp1");
    expect(calls).toEqual([{ method: "spell.update", args: [{ "system.location.signature": true }] }]);
  });

  it("sets focus points (clamped at 0)", async () => {
    await setFocusPoints("a", 2);
    await setFocusPoints("a", -3);
    expect(calls).toEqual([
      { method: "actor.update", args: [{ "system.resources.focus.value": 2 }] },
      { method: "actor.update", args: [{ "system.resources.focus.value": 0 }] },
    ]);
  });

  it("never throws when a mutation rejects", async () => {
    (globalThis as { game?: unknown }).game = {
      actors: { get: () => ({ spellcasting: { get: () => ({ spells: { get: () => null, prepareSpell: () => Promise.reject(new Error("x")) } }) }, items: { get: () => null } }) },
    };
    await expect(unprepareSpell("a", "e1", "1", 0)).resolves.toBeUndefined();
  });
});

describe("buildSpellbookView", () => {
  it("prepared: slots from groups, available from prepList", () => {
    const d: SpellcastingSheetDataLike = {
      id: "e1",
      name: "Wiz",
      category: "prepared",
      isPrepared: true,
      groups: [
        {
          id: 1,
          label: "1st Rank",
          active: [{ spell: { id: "s1", name: "Grease", system: { time: { value: "2" } } } }, null],
        },
      ],
      prepList: {
        1: [
          { spell: { id: "s1", name: "Grease", system: { time: { value: "2" } } } },
          { spell: { id: "s9", name: "Shield", system: { time: { value: "1" } } } },
        ],
      },
    };
    const v = buildSpellbookView(d);
    expect(v.kind).toBe("prepared");
    expect(v.ranks[0].slots).toEqual([
      { slotIndex: 0, spell: { id: "s1", name: "Grease", glyph: "2" } },
      { slotIndex: 1, spell: null },
    ]);
    expect(v.ranks[0].known.map((k) => k.id)).toEqual(["s1", "s9"]);
  });

  it("spontaneous: repertoire with signature flags, no slots", () => {
    const d: SpellcastingSheetDataLike = {
      id: "e2",
      name: "Sorc",
      category: "spontaneous",
      isSpontaneous: true,
      groups: [
        { id: 1, label: "1st Rank", active: [{ spell: { id: "a", name: "Fear", system: { time: { value: "2" } } }, signature: true }] },
      ],
    };
    const v = buildSpellbookView(d);
    expect(v.kind).toBe("spontaneous");
    expect(v.ranks[0].slots).toEqual([]);
    expect(v.ranks[0].known[0]).toMatchObject({ id: "a", signature: true });
  });
});
