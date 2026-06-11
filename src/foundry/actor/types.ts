// Type contract for the character sheet: the view the UI renders, plus the
// structural shape of the live actor the mappers read.

/** Proficiency rank: Untrained..Legendary. */
export type Rank = 0 | 1 | 2 | 3 | 4;

/** One line of a modifier breakdown popup (#5): "Proficiency +9". */
export interface ModPartView { label: string; value: number; }

// ---------- View (what the UI renders) ----------

export interface HpView { value: number; temp: number; max: number; }
export interface HeroPointsView { value: number; max: number; }

export interface HeaderView {
  name: string;
  img?: string;
  level: number;
  /** e.g. "Human Fighter" — ancestry + class, blanks collapsed. */
  ancestryClassLine: string;
  heroPoints: HeroPointsView;
  hp: HpView;
  dying: { value: number; max: number };
  wounded: number;
  ac: number;
  perceptionMod: number;
  speed: number;
}

export interface SaveView { slug: "fortitude" | "reflex" | "will"; label: string; mod: number; rank: Rank; breakdown?: ModPartView[]; }
export interface SenseView { label: string; }
export interface SpeedView { type: string; label: string; value: number; }
export interface ClassDcView { slug: string; label: string; value: number; rank: Rank; primary: boolean; breakdown?: ModPartView[]; }
export interface ShieldView { ac: number; hp: { value: number; max: number }; hardness: number; broken: boolean; raised: boolean; }
export interface InitiativeOption { value: string; label: string; }
export interface InitiativeView { mod: number; statistic: string; options: InitiativeOption[]; }

export interface DefensesView {
  ac: number;
  acBreakdown?: ModPartView[];
  shield?: ShieldView;
  saves: SaveView[];
  perception: { mod: number; rank: Rank; senses: SenseView[]; breakdown?: ModPartView[] };
  initiative: InitiativeView;
  classDCs: ClassDcView[];
  speeds: SpeedView[];
}

export interface AbilityView { slug: string; label: string; mod: number; key: boolean; }

/** Immunity/resistance/weakness — PF2e precomposes `.label` (incl. value). */
export interface IwrView { label: string; }
export interface TraitsView { size: string; immunities: IwrView[]; resistances: IwrView[]; weaknesses: IwrView[]; }

export interface SkillView { slug: string; label: string; mod: number; rank: Rank; armor: boolean; lore: boolean; breakdown?: ModPartView[]; }

export interface ConditionView { slug: string; name: string; value: number | null; img?: string; locked: boolean; }
export interface EffectView { name: string; img?: string; badge: string | null; }

export interface CoinsView { cp: number; sp: number; gp: number; pp: number; }
export interface InventoryItemView {
  id: string;
  name: string;
  img?: string;
  quantity: number;
  bulkLabel: string;
  priceLabel: string;
  /** "worn" | "held" | "stowed" | "dropped". */
  carryType: string;
  handsHeld: number;
  /** null = not investable. */
  invested: boolean | null;
  equipped: boolean;
  isContainer: boolean;
  containerId: string | null;
}
export interface InventoryCategoryView { key: string; label: string; items: InventoryItemView[]; }
export interface InventoryView { categories: InventoryCategoryView[]; currency: CoinsView; bulkLabel: string; encumbered: boolean; }

export interface FeatView { id: string; name: string; img?: string; actionGlyph: string | null; traits: string[]; level: number; }
export interface FeatGroupView { key: string; label: string; feats: FeatView[]; }

export interface ProficiencyView { label: string; rank: Rank; }
export interface BioView {
  ancestry?: string; heritage?: string; background?: string; className?: string; deity?: string;
  size: string;
  languages: string[];
  attacks: ProficiencyView[];
  defenses: ProficiencyView[];
  appearance?: string;
  backstory?: string;
}

export interface CharacterView {
  id: string;
  header: HeaderView;
  defenses: DefensesView;
  abilities: AbilityView[];
  traits: TraitsView;
  skills: SkillView[];
  conditions: ConditionView[];
  effects: EffectView[];
  inventory: InventoryView;
  featGroups: FeatGroupView[];
  bio: BioView;
}

// ---------- Source (the live actor, structurally) ----------
// Only the members the mappers read. The real CharacterPF2e satisfies this
// via `actor as unknown as CharacterLike` at the call site.

export interface IwrLike { label: string; value?: number; }
/** A live PF2e modifier (from a StatisticModifier/Statistic) for breakdowns (#5). */
export interface ModifierLike { label: string; modifier: number; enabled?: boolean; type?: string; }
export interface SkillLike { slug: string; label: string; mod: number; rank: number; armor: boolean; lore?: boolean; modifiers?: ModifierLike[]; check?: { modifiers?: ModifierLike[] }; }
export interface ConditionLike { slug: string; name: string; value: number | null; img?: string; isLocked?: boolean; }
export interface EffectLike { name: string; img?: string; badge?: { value?: number; label?: string } | null; }

export interface InventoryItemLike {
  id: string;
  name: string;
  img?: string;
  quantity: number;
  type: string;
  bulk?: { value: number };
  isContainer?: boolean;
  container?: { id: string } | null;
  system: {
    bulk?: { value: number };
    price?: { value: { cp?: number; sp?: number; gp?: number; pp?: number } };
    equipped: { carryType: string; handsHeld?: number; invested?: boolean | null };
  };
}

export interface FeatLike {
  id: string;
  name: string;
  img?: string;
  system: {
    category: string;
    level?: { value: number };
    actionType?: { value: string | null };
    actions?: { value: number | null };
    traits?: { value: string[] };
  };
}

export interface CharacterLike {
  id: string;
  name: string;
  img?: string;
  system: {
    details: {
      level: { value: number };
      languages?: { value: string[] };
      keyability?: { value: string };
      biography?: { appearance?: string; backstory?: string };
    };
    attributes: {
      hp: { value: number; temp: number; max: number };
      ac: { value: number; modifiers?: ModifierLike[] };
      dying: { value: number; max: number };
      wounded: { value: number };
      shield?: { itemId: string | null; ac: number; hp: { value: number; max: number }; hardness: number; broken: boolean; raised?: boolean };
      immunities?: IwrLike[];
      resistances?: IwrLike[];
      weaknesses?: IwrLike[];
    };
    saves: Record<"fortitude" | "reflex" | "will", { value: number; rank: number; modifiers?: ModifierLike[] }>;
    perception: { value: number; rank: number; senses: { label?: string; type?: string }[]; modifiers?: ModifierLike[] };
    initiative: { totalModifier: number; statistic: string };
    movement?: { speeds: Record<string, { value: number } | undefined> };
    abilities: Record<"str" | "dex" | "con" | "int" | "wis" | "cha", { mod: number }>;
    resources: { heroPoints: { value: number; max: number } };
    proficiencies?: {
      classDCs?: Record<string, { value: number; rank: number; slug: string; primary: boolean; label: string; modifiers?: ModifierLike[] }>;
      attacks?: Record<string, { label: string; rank: number; visible?: boolean }>;
      defenses?: Record<string, { label: string; rank: number; visible?: boolean }>;
    };
    traits: { size: { value: string } };
  };
  skills: Record<string, SkillLike>;
  conditions: { active: ConditionLike[] };
  itemTypes: { effect: EffectLike[]; feat: FeatLike[] };
  inventory: {
    contents: InventoryItemLike[];
    currency: CoinsView;
    /** PF2e `InventoryBulk`: `.value.normal` is the carried bulk; `.max` the limit. */
    bulk: { value: { normal: number }; max: number; isEncumbered: boolean };
  };
  ancestry?: { name: string } | null;
  heritage?: { name: string } | null;
  background?: { name: string } | null;
  class?: { name: string } | null;
  deity?: { name: string } | null;
}
