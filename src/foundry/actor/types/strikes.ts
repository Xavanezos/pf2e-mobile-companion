/** One MAP option on a strike: `label` is PF2e's precomposed sign string
 *  ("+17" / "+12" / "+7"); `penalty` is 0 / -5 / -10. */
export interface StrikeVariantView { label: string; penalty: number; }

/** A strike auxiliary action (draw / sheathe / change grip / retrieve …). */
export interface StrikeAuxView { label: string; glyph: string | null; }
/** One row of the attack breakdown; `slug` identifies it for the toggle. */
export interface StrikeModView { slug: string; label: string; value: number; enabled: boolean; }

/** Ranged ammunition for a strike's `<select>`; null for melee/thrown weapons. */
export interface StrikeAmmoView { options: { id: string; label: string }[]; selectedId: string | null; remaining: number; }

/** Result of a live attack-modifier preview: the grand total recomputed by
 *  PF2e's own stacking (incl. the MAP penalty), and the post-stacking modifier rows
 *  (with the user-disabled ones flipped to `enabled: false`). */
export interface StrikeAttackPreview { total: number; parts: StrikeModView[]; }

/** A single strike for the Actions tab. `index` is the position in
 *  `actor.system.actions` — the action layer re-reads the live strike by it. */
export interface StrikeView {
  index: number;
  slug: string;
  label: string;
  img?: string;
  ready: boolean;
  glyph: string; // strikes are always a single action
  traits: string[];
  variants: StrikeVariantView[];
  auxiliaryActions: StrikeAuxView[];
  modifiers: StrikeModView[];
  ammo: StrikeAmmoView | null;
  hasDamage: boolean;
  hasCritical: boolean;
}

export type StrikesView = StrikeView[];

export interface StrikeVariantLike { label?: string; penalty?: number; }
export interface StrikeLike {
  type?: string;
  slug?: string;
  label?: string;
  ready?: boolean;
  traits?: (string | { label?: string; name?: string })[];
  variants?: StrikeVariantLike[];
  /** Live roll callbacks — present (functions) on real strikes; read only as flags. */
  damage?: unknown;
  critical?: unknown;
  auxiliaryActions?: { label?: string; glyph?: string }[];
  modifiers?: { slug?: string; label?: string; modifier?: number; enabled?: boolean; ignored?: boolean; hideIfDisabled?: boolean }[];
  selectedAmmoId?: string | null;
  ammunition?: {
    compatible?: { id: string; label: string }[];
    selected?: { id: string } | null;
    remaining?: number;
  } | null;
  item?: { img?: string };
}
export interface StrikeActorLike { system?: { actions?: StrikeLike[] }; }
