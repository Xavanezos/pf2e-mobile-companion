import type { CharacterLike, SkillView, Rank } from "../types";
import { readBreakdown } from "./modifiers";

export function mapSkills(a: CharacterLike): SkillView[] {
  return Object.values(a.skills)
    .map((s) => ({ slug: s.slug, label: s.label, mod: s.mod, rank: s.rank as Rank, armor: s.armor, lore: s.lore ?? false, breakdown: readBreakdown(s) }))
    .sort((x, y) => x.label.localeCompare(y.label));
}
