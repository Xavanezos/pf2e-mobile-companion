import type { StrikeActorLike, StrikeLike, StrikeVariantView, StrikeView, StrikesView } from "./types";

function mapTrait(t: string | { label?: string; name?: string }): string {
  if (typeof t === "string") return t;
  return t.label ?? t.name ?? "";
}

function mapVariants(variants: StrikeLike["variants"]): StrikeVariantView[] {
  return (variants ?? []).map((v) => ({ label: v.label ?? "", penalty: v.penalty ?? 0 }));
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
      hasDamage: typeof s.damage === "function",
      hasCritical: typeof s.critical === "function",
    });
  });
  return views;
}
