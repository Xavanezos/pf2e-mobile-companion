import type {
  AbilityView, CharacterLike, ConditionView, CoinsView, DefensesView, EffectView, HeaderView,
  InitiativeOption, InventoryCategoryView, InventoryItemLike, InventoryItemView, InventoryView,
  BioView, CharacterView, FeatGroupView, FeatView, ItemDetailLike, ItemDetailView, ModifierLike, ModPartView, ProficiencyView, Rank, SaveView, SkillView, SpeedView, TraitsView,
} from "./types";

/** Extract a modifier breakdown from a live PF2e statistic (#5). Defensive:
 *  handles StatisticModifier (`.modifiers`) and Statistic (`.check.modifiers`);
 *  a missing array yields []. Enabled modifiers only. */
function readBreakdown(stat: { modifiers?: ModifierLike[]; check?: { modifiers?: ModifierLike[] } } | undefined): ModPartView[] | undefined {
  const mods = stat?.modifiers ?? stat?.check?.modifiers ?? [];
  const parts = mods.filter((m) => m.enabled !== false).map((m) => ({ label: m.label, value: m.modifier }));
  return parts.length ? parts : undefined;
}

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

export function mapSkills(a: CharacterLike): SkillView[] {
  return Object.values(a.skills)
    .map((s) => ({ slug: s.slug, label: s.label, mod: s.mod, rank: s.rank as Rank, armor: s.armor, lore: s.lore ?? false, breakdown: readBreakdown(s) }))
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
  return a.itemTypes.effect.map((e) => ({ id: e.id, name: e.name, img: e.img, badge: effectBadgeLabel(e.badge) }));
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
  // PF2e exposes carried bulk via `inventory.bulk` (InventoryBulk), not `totalBulk`.
  // Guard every hop so an unexpected shape degrades to "0 / 0" instead of crashing render.
  const ib = a.inventory.bulk;
  const normal = ib?.value?.normal ?? 0;
  const max = ib?.max ?? 0;
  return { categories, currency, bulkLabel: `${normal} / ${max}`, encumbered: ib?.isEncumbered ?? false };
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
  actionType: { value?: string | null } | undefined,
  actions: { value?: number | null } | undefined,
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

const ITEM_TYPE_LABELS: Record<string, string> = {
  weapon: "Weapon", armor: "Armor", shield: "Shield", equipment: "Equipment",
  consumable: "Consumable", treasure: "Treasure", backpack: "Container",
  feat: "Feat", action: "Action", effect: "Effect", spell: "Spell",
};

/** Detail for the tap-for-info popup (#3): read lazily from a live item. Covers
 *  feats and physical items (and effects). `descriptionHtml` is raw — the
 *  component enriches it best-effort. */
export function buildItemDetail(it: ItemDetailLike): ItemDetailView {
  const sys = it.system;
  const rarity = sys.traits?.rarity;
  const traits = [
    ...(rarity && rarity !== "common" ? [rarity] : []),
    ...(sys.traits?.value ?? []),
  ];
  const meta: { label: string; value: string }[] = [];
  if (sys.quantity != null && sys.quantity > 1) meta.push({ label: "Quantity", value: String(sys.quantity) });
  if (sys.bulk?.value != null) meta.push({ label: "Bulk", value: formatBulk(sys.bulk.value) });
  const price = formatPrice(sys.price?.value ?? {});
  if (price !== DASH) meta.push({ label: "Price", value: price });
  if (sys.usage?.value) meta.push({ label: "Usage", value: sys.usage.value });
  return {
    name: it.name,
    img: it.img,
    typeLabel: ITEM_TYPE_LABELS[it.type] ?? it.type,
    level: sys.level?.value,
    traits,
    actionGlyph: actionGlyph(sys.actionType, sys.actions),
    meta,
    descriptionHtml: sys.description?.value ?? "",
  };
}

export function buildCharacterView(a: CharacterLike): CharacterView {
  return {
    id: a.id,
    header: mapHeader(a),
    defenses: mapDefenses(a),
    abilities: mapAbilities(a),
    traits: mapTraits(a),
    skills: mapSkills(a),
    conditions: mapConditions(a),
    effects: mapEffects(a),
    inventory: mapInventory(a),
    featGroups: mapFeats(a),
    bio: mapBio(a),
  };
}
