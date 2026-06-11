import type {
  AbilityView, CharacterLike, ConditionView, CoinsView, DefensesView, EffectView, HeaderView,
  InitiativeOption, InventoryCategoryView, InventoryItemLike, InventoryItemView, InventoryView,
  FeatGroupView, FeatView, Rank, SaveView, SkillView, SpeedView, TraitsView,
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

const DASH = "—";
/** Maps PF2e item.type → display category key + label + sort order. */
const ITEM_CATEGORY: Record<string, { key: string; label: string; order: number }> = {
  weapon: { key: "weapon", label: "Weapons", order: 0 },
  armor: { key: "armor", label: "Armor", order: 1 },
  equipment: { key: "equipment", label: "Equipment", order: 2 },
  consumable: { key: "consumable", label: "Consumables", order: 3 },
  treasure: { key: "treasure", label: "Treasure", order: 4 },
  backpack: { key: "container", label: "Containers", order: 5 },
};
const OTHER_CATEGORY = { key: "other", label: "Other", order: 6 };

export function formatBulk(value: number): string {
  if (!value) return DASH;
  if (value < 1) return "L";
  return String(Math.round(value * 100) / 100);
}

export function formatPrice(coins: { cp?: number; sp?: number; gp?: number; pp?: number }): string {
  for (const d of ["pp", "gp", "sp", "cp"] as const) {
    const n = coins[d];
    if (n) return `${n} ${d}`;
  }
  return DASH;
}

function mapInventoryItem(it: InventoryItemLike): InventoryItemView {
  const eq = it.system.equipped;
  const bulkValue = it.bulk?.value ?? it.system.bulk?.value ?? 0;
  return {
    id: it.id, name: it.name, img: it.img, quantity: it.quantity,
    bulkLabel: formatBulk(bulkValue),
    priceLabel: formatPrice(it.system.price?.value ?? {}),
    carryType: eq.carryType, handsHeld: eq.handsHeld ?? 0,
    invested: eq.invested ?? null,
    equipped: eq.carryType !== "stowed" && eq.carryType !== "dropped",
    isContainer: it.isContainer ?? false,
    containerId: it.container?.id ?? null,
  };
}

/** Reverse a display category key back to a representative item.type for ordering. */
function catType(key: string): string {
  return key === "container" ? "backpack" : key;
}

export function mapInventory(a: CharacterLike): InventoryView {
  const groups = new Map<string, InventoryCategoryView>();
  for (const it of a.inventory.contents) {
    const cat = ITEM_CATEGORY[it.type] ?? OTHER_CATEGORY;
    if (!groups.has(cat.key)) groups.set(cat.key, { key: cat.key, label: cat.label, items: [] });
    groups.get(cat.key)!.items.push(mapInventoryItem(it));
  }
  const categories = [...groups.values()].sort(
    (x, y) => (ITEM_CATEGORY[catType(x.key)]?.order ?? OTHER_CATEGORY.order) - (ITEM_CATEGORY[catType(y.key)]?.order ?? OTHER_CATEGORY.order),
  );
  const c = a.inventory.currency;
  const currency: CoinsView = { cp: c.cp ?? 0, sp: c.sp ?? 0, gp: c.gp ?? 0, pp: c.pp ?? 0 };
  return { categories, currency, bulkLabel: formatBulk(a.inventory.totalBulk.value), encumbered: a.attributes?.encumbered ?? false };
}

/** category key → label + display order. Unknown categories fall through to "other". */
const FEAT_GROUPS: Record<string, { label: string; order: number }> = {
  ancestry: { label: "Ancestry Feats", order: 0 },
  background: { label: "Background Feats", order: 1 },
  class: { label: "Class Feats", order: 2 },
  classfeature: { label: "Class Features", order: 3 },
  general: { label: "General Feats", order: 4 },
  skill: { label: "Skill Feats", order: 5 },
  bonus: { label: "Bonus Feats", order: 6 },
};
const OTHER_FEAT_GROUP = { label: "Other", order: 7 };

export function actionGlyph(
  actionType: { value: string | null } | undefined,
  actions: { value: number | null } | undefined,
): string | null {
  const type = actionType?.value;
  if (type === "action") return actions?.value ? String(actions.value) : "1";
  if (type === "reaction") return "reaction";
  if (type === "free") return "free";
  return null;
}

export function mapFeats(a: CharacterLike): FeatGroupView[] {
  const groups = new Map<string, FeatGroupView>();
  for (const f of a.itemTypes.feat) {
    const cat = f.system.category;
    const meta = FEAT_GROUPS[cat] ?? OTHER_FEAT_GROUP;
    const key = FEAT_GROUPS[cat] ? cat : "other";
    if (!groups.has(key)) groups.set(key, { key, label: meta.label, feats: [] });
    const view: FeatView = {
      id: f.id, name: f.name, img: f.img,
      actionGlyph: actionGlyph(f.system.actionType, f.system.actions),
      traits: f.system.traits?.value ?? [],
      level: f.system.level?.value ?? 0,
    };
    groups.get(key)!.feats.push(view);
  }
  for (const g of groups.values()) g.feats.sort((x, y) => x.level - y.level || x.name.localeCompare(y.name));
  return [...groups.values()].sort(
    (x, y) => (FEAT_GROUPS[x.key]?.order ?? OTHER_FEAT_GROUP.order) - (FEAT_GROUPS[y.key]?.order ?? OTHER_FEAT_GROUP.order),
  );
}
