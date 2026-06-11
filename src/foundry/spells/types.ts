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
  rituals: SpellRowView[];
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
}
