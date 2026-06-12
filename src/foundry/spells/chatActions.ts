/** Live spell-card actions driven from the mobile chat feed. Guarded like cast.ts:
 *  a rejected call surfaces via Foundry's toast and never throws into React. PF2e
 *  owns the rules math — these only trigger and supply the bound actor. */

interface SpellDamagePartial { formula?: string; type?: string; category?: string | null }

/** Pure: a readable base-damage string for the damage popup, e.g. "2d4 fire". */
export function buildSpellBaseDamage(damage: Record<string, SpellDamagePartial> | undefined): string {
  if (!damage) return "";
  return Object.values(damage)
    .map((d) => [d.formula, d.category ?? "", d.type ?? ""].filter(Boolean).join(" "))
    .filter(Boolean)
    .join(" + ");
}

/** Pure: pull a spell's linked effect UUID from its description, if any.
 *  PF2e links spell effects as @UUID[Compendium.pf2e.spell-effects.Item.<name-or-id>]. */
const SPELL_EFFECT_UUID = /@UUID\[(Compendium\.pf2e\.spell-effects\.Item\.[^\]]+)\]/;
export function findSpellEffectUuid(description: string | undefined): string | null {
  if (!description) return null;
  const m = SPELL_EFFECT_UUID.exec(description);
  return m ? m[1] : null;
}
