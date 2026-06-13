import type { CharacterLike, BioView, ProficiencyView, Rank } from "../types";

const SIZE_LABELS: Record<string, string> = { tiny: "Tiny", sm: "Small", med: "Medium", lg: "Large", huge: "Huge", grg: "Gargantuan" };

/** Title-case a proficiency record key, e.g. "light-barding" → "Light Barding". */
function titleCaseKey(key: string): string {
  return key.split(/[-_]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function mapProficiencies(rec?: Record<string, { label?: string; rank: number; visible?: boolean }>): ProficiencyView[] {
  // Live PF2e keys these by name (simple/martial/unarmored/…) with NO `label`
  // field — derive the label from the key when it's absent.
  return Object.entries(rec ?? {})
    .filter(([, p]) => p.visible !== false)
    .map(([key, p]) => ({ label: p.label || titleCaseKey(key), rank: p.rank as Rank }));
}

export function mapBio(a: CharacterLike): BioView {
  const s = a.system;
  return {
    ancestry: a.ancestry?.name, heritage: a.heritage?.name, background: a.background?.name,
    className: a.class?.name, deity: a.deity?.name ?? undefined,
    size: SIZE_LABELS[s.traits.size.value] ?? s.traits.size.value,
    languages: s.details.languages?.value ?? [],
    attacks: mapProficiencies(s.proficiencies?.attacks),
    defenses: mapProficiencies(s.proficiencies?.defenses),
    appearance: s.details.biography?.appearance || undefined,
    backstory: s.details.biography?.backstory || undefined,
  };
}
