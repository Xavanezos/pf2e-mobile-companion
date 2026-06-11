import { describe, it, expect } from "vitest";
import { buildItemDetail } from "../src/foundry/actor/view";
import type { ItemDetailLike } from "../src/foundry/actor/types";

describe("buildItemDetail (#3)", () => {
  it("maps a feat: type label, level, action glyph, traits, description", () => {
    const feat: ItemDetailLike = {
      name: "Sudden Charge", img: "sc.webp", type: "feat",
      system: {
        description: { value: "<p>Stride twice…</p>" },
        traits: { value: ["flourish", "open"] },
        level: { value: 1 },
        actionType: { value: "action" }, actions: { value: 2 },
      },
    };
    const d = buildItemDetail(feat);
    expect(d).toMatchObject({
      name: "Sudden Charge", img: "sc.webp", typeLabel: "Feat", level: 1,
      traits: ["flourish", "open"], actionGlyph: "2", descriptionHtml: "<p>Stride twice…</p>",
    });
    expect(d.meta).toEqual([]); // feats carry no bulk/price/qty
  });

  it("maps a physical item: quantity, bulk, price, usage meta + rarity trait", () => {
    const item: ItemDetailLike = {
      name: "Healing Potion", type: "consumable",
      system: {
        description: { value: "<p>Drink…</p>" },
        traits: { value: ["healing"], rarity: "uncommon" },
        level: { value: 3 },
        quantity: 2,
        bulk: { value: 0.1 },
        price: { value: { gp: 12 } },
        usage: { value: "held-in-one-hand" },
      },
    };
    const d = buildItemDetail(item);
    expect(d.typeLabel).toBe("Consumable");
    expect(d.actionGlyph).toBeNull();
    expect(d.traits).toEqual(["uncommon", "healing"]); // rarity prepended, common omitted
    expect(d.meta).toEqual([
      { label: "Quantity", value: "2" },
      { label: "Bulk", value: "L" },
      { label: "Price", value: "12 gp" },
      { label: "Usage", value: "held-in-one-hand" },
    ]);
  });

  it("is safe when optional fields are missing", () => {
    const bare: ItemDetailLike = { name: "Mystery", type: "equipment", system: {} };
    const d = buildItemDetail(bare);
    expect(d).toMatchObject({ name: "Mystery", typeLabel: "Equipment", traits: [], actionGlyph: null, descriptionHtml: "", meta: [] });
    expect(d.level).toBeUndefined();
  });
});
