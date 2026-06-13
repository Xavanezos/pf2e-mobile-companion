import type { CharacterLike, ConditionView, EffectView } from "../types";

export function effectBadgeLabel(badge: { value?: number; label?: string } | null | undefined): string | null {
  if (!badge) return null;
  if (badge.label) return badge.label;
  if (typeof badge.value === "number") return String(badge.value);
  return null;
}

export function mapConditions(a: CharacterLike): ConditionView[] {
  return a.conditions.active.map((c) => ({
    slug: c.slug, name: c.name, value: c.value, img: c.img, locked: c.isLocked ?? false,
  }));
}

export function mapEffects(a: CharacterLike): EffectView[] {
  return a.itemTypes.effect.map((e) => ({ id: e.id, name: e.name, img: e.img, badge: effectBadgeLabel(e.badge) }));
}
