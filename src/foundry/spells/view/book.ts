import type {
  ActiveSpellLike,
  SpellcastingSheetDataLike,
  SpellbookOptionView,
  SpellbookRankView,
  SpellbookSlotView,
  SpellbookSourceLike,
  SpellbookView,
} from "../types";
import { spellGlyph } from "./casting";

/** Pure: build the spellbook editor view. Prepared casters get slots (to fill from
 *  `prepList`); spontaneous casters get their repertoire (to manage). */
export function buildSpellbookView(d: SpellcastingSheetDataLike, book: SpellbookSourceLike[] = []): SpellbookView {
  const kind: "prepared" | "spontaneous" = d.isPrepared ? "prepared" : "spontaneous";
  const rankNumber = (id: "cantrips" | number): number => (id === "cantrips" ? 0 : Number(id));
  const ranks: SpellbookRankView[] = d.groups.map((g) => {
    const rank = rankNumber(g.id);
    if (d.isPrepared) {
      const slots: SpellbookSlotView[] = g.active.map((a, i) => ({
        slotIndex: i,
        spell: a ? { id: a.spell.id, name: a.spell.name, glyph: spellGlyph(a.spell.system?.time?.value) } : null,
      }));
      // Available to prepare = the entry's collection (the "book"), matched to the
      // slot group: cantrips group → cantrip spells; a rank-N group → non-cantrip
      // spells of rank N. (getSheetData().prepList is null in PF2e v8.2 — verified
      // live against Ezren — so we read the book directly.)
      const known: SpellbookOptionView[] = book
        .filter((b) => (g.id === "cantrips" ? !!b.isCantrip : !b.isCantrip && Number(b.rank) === rank))
        .map((b) => ({ id: b.id, name: b.name, glyph: spellGlyph(b.system?.time?.value) }));
      return { id: String(g.id), rank, label: g.label, slots, known };
    }
    const known: SpellbookOptionView[] = g.active
      .filter((a): a is ActiveSpellLike => a != null)
      .map((a) => ({
        id: a.spell.id,
        name: a.spell.name,
        glyph: spellGlyph(a.spell.system?.time?.value),
        signature: a.signature ?? false,
      }));
    return { id: String(g.id), rank, label: g.label, slots: [], known };
  });
  return { entryId: d.id, kind, ranks };
}
