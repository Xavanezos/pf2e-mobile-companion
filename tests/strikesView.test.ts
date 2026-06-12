import { describe, it, expect } from "vitest";
import { buildStrikesView } from "../src/foundry/actor/strikes";
import type { StrikeActorLike } from "../src/foundry/actor/types";

const strike = (over: Record<string, unknown> = {}) => ({
  type: "strike",
  slug: "longsword",
  label: "Longsword",
  ready: true,
  item: { img: "i/longsword.webp" },
  traits: [{ label: "Versatile P" }, "magical"],
  variants: [
    { label: "+17", penalty: 0 },
    { label: "+12", penalty: -5 },
    { label: "+7", penalty: -10 },
  ],
  damage: () => Promise.resolve(),
  critical: () => Promise.resolve(),
  ...over,
});

describe("buildStrikesView", () => {
  it("maps a strike: variant labels/penalties, ready, traits, img, glyph, damage flags", () => {
    const actor: StrikeActorLike = { system: { actions: [strike()] } };
    const v = buildStrikesView(actor);
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({
      index: 0,
      slug: "longsword",
      label: "Longsword",
      img: "i/longsword.webp",
      ready: true,
      glyph: "1",
      traits: ["Versatile P", "magical"],
      hasDamage: true,
      hasCritical: true,
    });
    expect(v[0].variants).toEqual([
      { label: "+17", penalty: 0 },
      { label: "+12", penalty: -5 },
      { label: "+7", penalty: -10 },
    ]);
  });

  it("preserves the ORIGINAL actions index when a non-strike precedes it", () => {
    const actor: StrikeActorLike = {
      system: { actions: [{ type: "area-attack" }, strike({ slug: "fist", label: "Fist" })] },
    };
    const v = buildStrikesView(actor);
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ index: 1, slug: "fist" });
  });

  it("skips entries with no variants and flags missing damage/critical", () => {
    const actor: StrikeActorLike = {
      system: {
        actions: [
          strike({ slug: "novariants", variants: [] }),
          strike({ slug: "bow", damage: undefined, critical: undefined }),
        ],
      },
    };
    const v = buildStrikesView(actor);
    expect(v.map((s) => s.slug)).toEqual(["bow"]);
    expect(v[0]).toMatchObject({ hasDamage: false, hasCritical: false });
  });

  it("returns [] when the actor has no actions", () => {
    expect(buildStrikesView({})).toEqual([]);
    expect(buildStrikesView({ system: {} })).toEqual([]);
  });

  it("maps auxiliary actions and enabled modifiers (dropping hidden-disabled ones)", () => {
    const actor: StrikeActorLike = {
      system: {
        actions: [
          strike({
            auxiliaryActions: [
              { label: "Draw", glyph: "1" },
              { label: "Change Grip", glyph: "1" },
            ],
            modifiers: [
              { slug: "prof", label: "Proficiency", modifier: 9, enabled: true },
              { slug: "rune", label: "Potency", modifier: 1, enabled: true, hideIfDisabled: true },
              { slug: "off", label: "Inactive", modifier: 2, enabled: false, hideIfDisabled: true },
            ],
          }),
        ],
      },
    };
    const v = buildStrikesView(actor);
    expect(v[0].auxiliaryActions).toEqual([
      { label: "Draw", glyph: "1" },
      { label: "Change Grip", glyph: "1" },
    ]);
    expect(v[0].modifiers).toEqual([
      { slug: "prof", label: "Proficiency", value: 9, enabled: true },
      { slug: "rune", label: "Potency", value: 1, enabled: true },
    ]);
  });

  it("defaults auxiliaryActions and modifiers to [] when absent", () => {
    const v = buildStrikesView({ system: { actions: [strike()] } });
    expect(v[0].auxiliaryActions).toEqual([]);
    expect(v[0].modifiers).toEqual([]);
  });

  it("maps ranged ammunition (options/selected/remaining) and null for non-ammo strikes", () => {
    const ranged = strike({
      slug: "longbow",
      ammunition: {
        compatible: [
          { id: "arrows", label: "Arrows (19)" },
          { id: "cold-iron", label: "Cold Iron Arrows (10)" },
        ],
        selected: { id: "arrows" },
        remaining: 19,
      },
    });
    const v = buildStrikesView({ system: { actions: [ranged, strike({ slug: "fist" })] } });
    expect(v[0].ammo).toEqual({
      options: [
        { id: "arrows", label: "Arrows (19)" },
        { id: "cold-iron", label: "Cold Iron Arrows (10)" },
      ],
      selectedId: "arrows",
      remaining: 19,
    });
    expect(v[1].ammo).toBeNull();
  });

  it("falls back to selectedAmmoId and remaining 0 when ammunition.selected is absent", () => {
    const ranged = strike({ slug: "sling", selectedAmmoId: "bullets", ammunition: { compatible: [{ id: "bullets", label: "Bullets (5)" }] } });
    const v = buildStrikesView({ system: { actions: [ranged] } });
    expect(v[0].ammo).toEqual({ options: [{ id: "bullets", label: "Bullets (5)" }], selectedId: "bullets", remaining: 0 });
  });
});
