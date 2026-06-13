import type { ModifierLike, ModPartView } from "../types";

/** Extract a modifier breakdown from a live PF2e statistic.
 *  Handles both StatisticModifier (`.modifiers`) and Statistic (`.check.modifiers`);
 *  a missing array yields []. Enabled modifiers only. */
export function readBreakdown(stat: { modifiers?: ModifierLike[]; check?: { modifiers?: ModifierLike[] } } | undefined): ModPartView[] | undefined {
  const mods = stat?.modifiers ?? stat?.check?.modifiers ?? [];
  const parts = mods.filter((m) => m.enabled !== false).map((m) => ({ label: m.label, value: m.modifier }));
  return parts.length ? parts : undefined;
}
