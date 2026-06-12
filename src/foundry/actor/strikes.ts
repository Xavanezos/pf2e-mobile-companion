import type { StrikeActorLike, StrikeLike, StrikeVariantView, StrikeView, StrikesView } from "./types";

function mapTrait(t: string | { label?: string; name?: string }): string {
  if (typeof t === "string") return t;
  return t.label ?? t.name ?? "";
}

function mapVariants(variants: StrikeLike["variants"]): StrikeVariantView[] {
  return (variants ?? []).map((v) => ({ label: v.label ?? "", penalty: v.penalty ?? 0 }));
}

/** PF2e's auxiliary-action glyph → our ActionGlyph code when recognised, else null
 *  (the row just shows its label). Aux actions are typically 1-action. */
function auxGlyph(g: string | undefined): string | null {
  if (g === "1" || g === "2" || g === "3" || g === "reaction" || g === "free") return g;
  return null;
}

/** Ranged ammo for the strike card. `strike.ammunition` is null for melee/thrown
 *  (PF2e's `getAttackAmmo` returns null when the weapon doesn't expend ammo). */
function mapAmmo(s: StrikeLike): StrikeView["ammo"] {
  const a = s.ammunition;
  if (!a) return null;
  return {
    options: (a.compatible ?? []).map((o) => ({ id: o.id, label: o.label })),
    selectedId: a.selected?.id ?? s.selectedAmmoId ?? null,
    remaining: a.remaining ?? 0,
  };
}

/** Pure: map `actor.system.actions` to the Strikes view. Keeps the ORIGINAL array
 *  index on each kept strike (the action layer re-reads the live strike by it),
 *  filters to real strikes (`type === "strike"` with a non-empty variants array),
 *  and never retains the live roll/damage callbacks (only `hasDamage`/`hasCritical`
 *  flags). Defensive over PF2e's shape. */
export function buildStrikesView(actor: StrikeActorLike): StrikesView {
  const actions = actor.system?.actions ?? [];
  const views: StrikeView[] = [];
  actions.forEach((s, index) => {
    if (s.type !== "strike") return;
    if (!Array.isArray(s.variants) || s.variants.length === 0) return;
    views.push({
      index,
      slug: s.slug ?? "",
      label: s.label ?? s.slug ?? "Strike",
      img: s.item?.img,
      ready: s.ready ?? false,
      glyph: "1",
      traits: (s.traits ?? []).map(mapTrait).filter(Boolean),
      variants: mapVariants(s.variants),
      auxiliaryActions: (s.auxiliaryActions ?? [])
        .map((a) => ({ label: a.label ?? "", glyph: auxGlyph(a.glyph) }))
        .filter((a) => a.label),
      modifiers: (s.modifiers ?? [])
        .filter((m) => m.enabled || !m.hideIfDisabled)
        .map((m) => ({ slug: m.slug ?? "", label: m.label ?? "", value: m.modifier ?? 0, enabled: m.enabled ?? false })),
      ammo: mapAmmo(s),
      hasDamage: typeof s.damage === "function",
      hasCritical: typeof s.critical === "function",
    });
  });
  return views;
}
