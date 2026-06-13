import type { CharacterLike, DefensesView, InitiativeOption, AbilityView, TraitsView, SaveView, SpeedView, Rank } from "../types";
import { readBreakdown } from "./modifiers";

const SAVE_LABELS: Record<SaveView["slug"], string> = { fortitude: "Fortitude", reflex: "Reflex", will: "Will" };
const ABILITY_LABELS: Record<string, string> = { str: "STR", dex: "DEX", con: "CON", int: "INT", wis: "WIS", cha: "CHA" };
const SPEED_LABELS: Record<string, string> = { land: "Land", fly: "Fly", swim: "Swim", climb: "Climb", burrow: "Burrow" };
const SIZE_LABELS: Record<string, string> = { tiny: "Tiny", sm: "Small", med: "Medium", lg: "Large", huge: "Huge", grg: "Gargantuan" };

export function initiativeOptions(a: CharacterLike): InitiativeOption[] {
  const skills = Object.values(a.skills).map((s) => ({ value: s.slug, label: s.label }));
  return [{ value: "perception", label: "Perception" }, ...skills];
}

export function mapDefenses(a: CharacterLike): DefensesView {
  const s = a.system;
  const sh = s.attributes.shield;
  const saves: SaveView[] = (["fortitude", "reflex", "will"] as const).map((slug) => ({
    slug, label: SAVE_LABELS[slug], mod: s.saves[slug].value, rank: s.saves[slug].rank as Rank,
    breakdown: readBreakdown(s.saves[slug]),
  }));
  // Only real movement types — PF2e also stuffs a derived `travel` speed in here.
  const speeds: SpeedView[] = Object.entries(s.movement?.speeds ?? {})
    .filter(([type, v]) => type in SPEED_LABELS && v && typeof v.value === "number")
    .map(([type, v]) => ({ type, label: SPEED_LABELS[type], value: (v as { value: number }).value }));
  const classDCs = Object.values(s.proficiencies?.classDCs ?? {}).map((c) => ({
    slug: c.slug, label: c.label, value: c.value, rank: c.rank as Rank, primary: c.primary,
    breakdown: readBreakdown(c),
  }));
  return {
    ac: s.attributes.ac.value,
    acBreakdown: readBreakdown(s.attributes.ac),
    shield: sh && sh.itemId
      ? { ac: sh.ac, hp: { value: sh.hp.value, max: sh.hp.max }, hardness: sh.hardness, broken: sh.broken, raised: sh.raised ?? false }
      : undefined,
    saves,
    perception: { mod: s.perception.value, rank: s.perception.rank as Rank,
      senses: s.perception.senses.map((x) => ({ label: x.label ?? x.type ?? "" })).filter((x) => x.label),
      breakdown: readBreakdown(s.perception) },
    initiative: { mod: s.initiative.totalModifier, statistic: s.initiative.statistic, options: initiativeOptions(a) },
    classDCs,
    speeds,
  };
}

export function mapAbilities(a: CharacterLike): AbilityView[] {
  const key = a.system.details.keyability?.value;
  return (["str", "dex", "con", "int", "wis", "cha"] as const).map((slug) => ({
    slug, label: ABILITY_LABELS[slug], mod: a.system.abilities[slug].mod, key: slug === key,
  }));
}

export function mapTraits(a: CharacterLike): TraitsView {
  const at = a.system.attributes;
  const iwr = (xs?: { label: string }[]) => (xs ?? []).map((x) => ({ label: x.label }));
  return {
    size: SIZE_LABELS[a.system.traits.size.value] ?? a.system.traits.size.value,
    immunities: iwr(at.immunities), resistances: iwr(at.resistances), weaknesses: iwr(at.weaknesses),
  };
}
