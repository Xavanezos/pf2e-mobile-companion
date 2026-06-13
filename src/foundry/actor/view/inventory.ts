import type { CharacterLike, CoinsView, InventoryCategoryView, InventoryItemLike, InventoryItemView, InventoryView } from "../types";

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
