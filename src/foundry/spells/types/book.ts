// View + source shapes for the spellbook (prepare / manage known spells).

export interface SpellbookOptionView {
  id: string;
  name: string;
  glyph: string | null;
  signature?: boolean;
}
export interface SpellbookSlotView {
  slotIndex: number;
  spell: { id: string; name: string; glyph: string | null } | null;
}
export interface SpellbookRankView {
  id: string;
  rank: number;
  label: string;
  /** Prepared casters: the slots to fill. Spontaneous: empty. */
  slots: SpellbookSlotView[];
  /** Prepared: spells available to prepare at this rank. Spontaneous: repertoire. */
  known: SpellbookOptionView[];
}
export interface SpellbookView {
  entryId: string;
  kind: "prepared" | "spontaneous";
  ranks: SpellbookRankView[];
}

/** A spell from the entry's collection (the "book") for the prepare picker. */
export interface SpellbookSourceLike {
  id: string;
  name: string;
  rank?: number;
  isCantrip?: boolean;
  system?: { time?: { value?: string } };
}
