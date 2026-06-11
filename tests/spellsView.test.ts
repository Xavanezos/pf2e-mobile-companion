import { describe, it, expect } from "vitest";
import { mapSpellcastingEntry } from "../src/foundry/spells/view";
import type { SpellcastingSheetDataLike } from "../src/foundry/spells/types";

const spell = (id: string, name: string, time = "2", level = 1) => ({
  id,
  name,
  img: `i/${id}.webp`,
  isCantrip: level === 0,
  system: { time: { value: time }, level: { value: level } },
});

const focusPool = { value: 1, max: 2 };

describe("mapSpellcastingEntry", () => {
  it("maps a prepared entry: ranks, slot uses from expended flags, glyph + atWill for cantrips", () => {
    const data: SpellcastingSheetDataLike = {
      id: "e1",
      name: "Wizard Spells",
      category: "prepared",
      isPrepared: true,
      tradition: "arcane",
      statistic: { dc: { value: 17 }, check: { mod: 9 } },
      groups: [
        { id: "cantrips", label: "Cantrips", active: [{ spell: spell("c1", "Detect Magic", "2", 0) }] },
        {
          id: 1,
          label: "1st Rank",
          uses: { max: 3 },
          active: [
            { spell: spell("s1", "Magic Missile"), expended: true },
            { spell: spell("s2", "Grease"), expended: false },
            null,
          ],
        },
      ],
    };
    const v = mapSpellcastingEntry(data, focusPool);
    expect(v).toMatchObject({ kind: "prepared", tradition: "arcane", attackMod: 9, dc: 17 });
    expect(v.ranks).toHaveLength(2);
    expect(v.ranks[0]).toMatchObject({ id: "cantrips", uses: null });
    expect(v.ranks[0].spells[0]).toMatchObject({ id: "c1", glyph: "2", atWill: true, rank: 0 });
    expect(v.ranks[1].uses).toEqual({ value: 1, max: 3 });
    expect(v.ranks[1].spells.map((s) => s.id)).toEqual(["s1", "s2"]);
    expect(v.ranks[1].spells[0]).toMatchObject({ id: "s1", expended: true, slotIndex: 0 });
    expect(v.ranks[1].spells[1]).toMatchObject({ id: "s2", expended: false, slotIndex: 1 });
  });

  it("maps a spontaneous entry: uses straight from the group + signature flag", () => {
    const data: SpellcastingSheetDataLike = {
      id: "e2",
      name: "Bard",
      category: "spontaneous",
      isSpontaneous: true,
      tradition: "occult",
      statistic: { dc: { value: 18 }, check: { mod: 10 } },
      groups: [
        {
          id: 1,
          label: "1st Rank",
          uses: { value: 2, max: 3 },
          active: [{ spell: spell("a", "Soothe") }, { spell: spell("b", "Fear"), signature: true }],
        },
      ],
    };
    const v = mapSpellcastingEntry(data, focusPool);
    expect(v.kind).toBe("spontaneous");
    expect(v.ranks[0].uses).toEqual({ value: 2, max: 3 });
    expect(v.ranks[0].spells[1]).toMatchObject({ id: "b", signature: true, slotIndex: null });
  });

  it("maps a focus entry: the non-cantrip group draws on the focus pool", () => {
    const data: SpellcastingSheetDataLike = {
      id: "e3",
      name: "Cleric Focus",
      category: "focus",
      isFocusPool: true,
      tradition: "divine",
      statistic: { dc: { value: 16 }, check: { mod: 8 } },
      groups: [{ id: 1, label: "1st Rank", active: [{ spell: spell("f1", "Lay on Hands", "1") }] }],
    };
    const v = mapSpellcastingEntry(data, focusPool);
    expect(v.kind).toBe("focus");
    expect(v.ranks[0].uses).toEqual({ value: 1, max: 2 });
    expect(v.ranks[0].spells[0]).toMatchObject({ id: "f1", glyph: "1" });
  });
});
