import { describe, it, expect } from "vitest";
import { mapInventory, formatBulk, formatPrice } from "../src/foundry/actor/view";
import { makeCharacterLike } from "./fixtures/characterLike";
import type { InventoryItemLike } from "../src/foundry/actor/types";

const item = (over: Partial<InventoryItemLike> & { id: string; name: string; type: string }): InventoryItemLike => ({
  quantity: 1,
  bulk: { value: 1 },
  system: { equipped: { carryType: "worn" } },
  ...over,
});

describe("formatBulk", () => {
  it("renders 0 as dash, <1 as L, else the number", () => {
    expect(formatBulk(0)).toBe("—");
    expect(formatBulk(0.1)).toBe("L");
    expect(formatBulk(2)).toBe("2");
  });
});

describe("formatPrice", () => {
  it("renders the highest non-zero denomination", () => {
    expect(formatPrice({ gp: 5, sp: 2 })).toBe("5 gp");
    expect(formatPrice({ cp: 8 })).toBe("8 cp");
    expect(formatPrice({})).toBe("—");
  });
});

describe("mapInventory", () => {
  it("groups items by category and maps equip/invest state", () => {
    const a = makeCharacterLike();
    a.inventory.contents = [
      item({ id: "w1", name: "Longsword", type: "weapon", bulk: { value: 1 },
        system: { equipped: { carryType: "held", handsHeld: 1 }, price: { value: { gp: 1 } } } }),
      item({ id: "a1", name: "Breastplate", type: "armor", bulk: { value: 2 },
        system: { equipped: { carryType: "worn", invested: false } } }),
      item({ id: "p1", name: "Bag", type: "backpack", isContainer: true,
        system: { equipped: { carryType: "worn" } } }),
    ];
    a.inventory.currency = { cp: 0, sp: 5, gp: 12, pp: 0 };
    a.inventory.bulk = { value: { normal: 3 }, max: 9, isEncumbered: false };
    const inv = mapInventory(a);

    expect(inv.categories.map((c) => c.key)).toEqual(["weapon", "armor", "container"]);
    const sword = inv.categories[0].items[0];
    expect(sword).toMatchObject({ id: "w1", name: "Longsword", carryType: "held", handsHeld: 1, equipped: true, invested: null, bulkLabel: "1", priceLabel: "1 gp" });
    expect(inv.categories[1].items[0]).toMatchObject({ invested: false, equipped: true });
    expect(inv.categories[2].items[0]).toMatchObject({ isContainer: true });
    expect(inv.currency).toEqual({ cp: 0, sp: 5, gp: 12, pp: 0 });
    expect(inv.bulkLabel).toBe("3 / 9");
    expect(inv.encumbered).toBe(false);
  });

  it("treats stowed/dropped as not equipped", () => {
    const a = makeCharacterLike();
    a.inventory.contents = [item({ id: "x", name: "Torch", type: "consumable", system: { equipped: { carryType: "stowed" } } })];
    expect(mapInventory(a).categories[0].items[0].equipped).toBe(false);
  });
});
