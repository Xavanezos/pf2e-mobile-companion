// View + source shapes for the Spells sub-tab (Phase 3 spells). The view is what
// the UI renders; the *Like shapes are the structural slice of the live PF2e
// spellcasting data the mappers read (the real SpellcastingSheetData satisfies
// SpellcastingSheetDataLike via `as unknown as`).

export type SpellEntryKind = "prepared" | "spontaneous" | "innate" | "focus";

export interface SpellRowView {
  id: string;
  name: string;
  img?: string;
  /** Action-cost glyph from cast time: "1"|"2"|"3"|"reaction"|"free" | null. */
  glyph: string | null;
  rank: number; // 0 = cantrips
  castRank: number;
  expended: boolean;
  signature: boolean;
  /** Cantrip / at-will → always castable, no slot consumed. */
  atWill: boolean;
  /** Prepared-slot index (for casting/clearing that slot); null otherwise. */
  slotIndex: number | null;
}

export interface SpellUsesView {
  /** null = unlimited. */
  value: number | null;
  max: number;
}

export interface SpellRankView {
  id: string; // "cantrips" | "1".."10"
  label: string;
  uses: SpellUsesView | null; // null = unlimited (cantrips / innate at-will)
  spells: SpellRowView[];
}

export interface SpellEntryView {
  id: string;
  name: string;
  kind: SpellEntryKind;
  tradition: string | null;
  attackMod: number | null;
  dc: number | null;
  ranks: SpellRankView[];
}

export interface ActivationView {
  id: string;
  name: string;
  img?: string;
  spellName: string | null;
  glyph: string | null;
  uses: { value: number; max: number } | null;
}

export interface SpellsView {
  entries: SpellEntryView[];
  ritualRanks: SpellRankView[];
  activations: ActivationView[];
  focus: { value: number; max: number } | null;
}

// ---------- source-like (only the members the mappers read) ----------

export interface SpellLike {
  id: string;
  name: string;
  img?: string;
  isCantrip?: boolean;
  atWill?: boolean;
  system?: { time?: { value?: string }; level?: { value?: number } };
}
export interface ActiveSpellLike {
  spell: SpellLike;
  castRank?: number;
  expended?: boolean;
  signature?: boolean;
  virtual?: boolean;
}
export interface SpellGroupLike {
  id: "cantrips" | number;
  label: string;
  uses?: { value?: number; max: number };
  active: (ActiveSpellLike | null)[];
}
export interface SpellStatisticLike {
  dc?: { value?: number };
  check?: { mod?: number };
}
export interface SpellcastingSheetDataLike {
  id: string;
  name: string;
  category: string;
  isPrepared?: boolean;
  isSpontaneous?: boolean;
  isInnate?: boolean;
  isFocusPool?: boolean;
  isRitual?: boolean;
  tradition?: string | null;
  statistic?: SpellStatisticLike | null;
  groups: SpellGroupLike[];
}

/** A live spellcasting entry as iterated from `actor.spellcasting`. */
export interface SpellcastingEntryRuntime {
  isRitual?: boolean;
  category?: string;
  getSheetData?: () => Promise<unknown>;
}
/** The live actor slice `buildSpellsView` reads. */
export interface SpellcastingActorLike {
  system?: { resources?: { focus?: { value?: number; max?: number } } };
  spellcasting?: Iterable<SpellcastingEntryRuntime>;
  itemTypes?: { consumable?: ActivationItemLike[] };
}

/** A consumable (wand/scroll) carrying an embedded spell — the Activations list. */
export interface ActivationItemLike {
  id: string;
  name: string;
  img?: string;
  system?: { spell?: { name?: string } | null; uses?: { value?: number; max?: number } };
}

// ---------- spell detail (tap-for-info popup) ----------

export interface SpellDetailView {
  name: string;
  img?: string;
  rank: number;
  glyph: string | null;
  traits: string[];
  meta: { label: string; value: string }[];
  descriptionHtml: string;
}
export interface SpellDetailLike {
  name: string;
  img?: string;
  system?: {
    level?: { value?: number };
    traits?: { value?: string[]; rarity?: string; traditions?: string[] };
    time?: { value?: string };
    range?: { value?: string };
    area?: { type?: string; value?: number } | null;
    target?: { value?: string };
    duration?: { value?: string };
    defense?: { save?: { statistic?: string; basic?: boolean } } | null;
    description?: { value?: string };
  };
}

// ---------- spellbook (prepare / manage known) ----------

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
