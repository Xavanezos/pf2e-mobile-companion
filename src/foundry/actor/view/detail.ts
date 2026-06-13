import type { ItemDetailLike, ItemDetailView } from "../types";
import { actionGlyph } from "./feats";
import { formatBulk, formatPrice } from "./inventory";

const DASH = "—";

const ITEM_TYPE_LABELS: Record<string, string> = {
  weapon: "Weapon", armor: "Armor", shield: "Shield", equipment: "Equipment",
  consumable: "Consumable", treasure: "Treasure", backpack: "Container",
  feat: "Feat", action: "Action", effect: "Effect", spell: "Spell",
};

/** Detail for the tap-for-info popup: read lazily from a live item. Covers
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
