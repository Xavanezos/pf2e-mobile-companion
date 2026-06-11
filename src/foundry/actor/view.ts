import type {
  AbilityView, CharacterLike, ConditionView, DefensesView, EffectView, HeaderView,
  InitiativeOption, Rank, SaveView, SkillView, SpeedView, TraitsView,
} from "./types";

export function mapHeader(a: CharacterLike): HeaderView {
  const s = a.system;
  const ancestryClassLine = [a.ancestry?.name, a.class?.name].filter(Boolean).join(" ");
  return {
    name: a.name,
    img: a.img,
    level: s.details.level.value,
    ancestryClassLine,
    heroPoints: { value: s.resources.heroPoints.value, max: s.resources.heroPoints.max },
    hp: { value: s.attributes.hp.value, temp: s.attributes.hp.temp, max: s.attributes.hp.max },
    dying: { value: s.attributes.dying.value, max: s.attributes.dying.max },
    wounded: s.attributes.wounded.value,
    ac: s.attributes.ac.value,
    perceptionMod: s.perception.value,
    speed: s.movement?.speeds.land?.value ?? 0,
  };
}

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
  }));
  const speeds: SpeedView[] = Object.entries(s.movement?.speeds ?? {})
    .filter(([, v]) => v && typeof v.value === "number")
    .map(([type, v]) => ({ type, label: SPEED_LABELS[type] ?? type, value: (v as { value: number }).value }));
  const classDCs = Object.values(s.proficiencies?.classDCs ?? {}).map((c) => ({
    slug: c.slug, label: c.label, value: c.value, rank: c.rank as Rank, primary: c.primary,
  }));
  return {
    ac: s.attributes.ac.value,
    shield: sh && sh.itemId
      ? { ac: sh.ac, hp: { value: sh.hp.value, max: sh.hp.max }, hardness: sh.hardness, broken: sh.broken, raised: sh.raised ?? false }
      : undefined,
    saves,
    perception: { mod: s.perception.value, rank: s.perception.rank as Rank,
      senses: s.perception.senses.map((x) => ({ label: x.label ?? x.type ?? "" })).filter((x) => x.label) },
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

export function mapSkills(a: CharacterLike): SkillView[] {
  return Object.values(a.skills)
    .map((s) => ({ slug: s.slug, label: s.label, mod: s.mod, rank: s.rank as Rank, armor: s.armor, lore: s.lore ?? false }))
    .sort((x, y) => x.label.localeCompare(y.label));
}

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
  return a.itemTypes.effect.map((e) => ({ name: e.name, img: e.img, badge: effectBadgeLabel(e.badge) }));
}
