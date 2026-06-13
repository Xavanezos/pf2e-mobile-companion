import type { SpellDetailLike, SpellDetailView } from "../types";
import { spellGlyph } from "./casting";

function formatArea(area: { type?: string; value?: number }): string {
  const parts = [area.value ? `${area.value}-foot` : "", area.type ?? ""].filter(Boolean);
  return parts.join(" ") || "—";
}

/** Pure: build the spell tap-for-info detail (rank, traits, cast/range/area/save,
 *  description). Optional fields in `spell.system` are read defensively. */
export function buildSpellDetail(s: SpellDetailLike): SpellDetailView {
  const sys = s.system ?? {};
  const rarity = sys.traits?.rarity;
  const traits = [
    ...(rarity && rarity !== "common" ? [rarity] : []),
    ...(sys.traits?.traditions ?? []),
    ...(sys.traits?.value ?? []),
  ];
  const meta: { label: string; value: string }[] = [];
  if (sys.time?.value) meta.push({ label: "Cast", value: sys.time.value });
  if (sys.range?.value) meta.push({ label: "Range", value: sys.range.value });
  if (sys.area) meta.push({ label: "Area", value: formatArea(sys.area) });
  if (sys.target?.value) meta.push({ label: "Targets", value: sys.target.value });
  if (sys.duration?.value) meta.push({ label: "Duration", value: sys.duration.value });
  const save = sys.defense?.save;
  if (save?.statistic) meta.push({ label: "Defense", value: `${save.basic ? "basic " : ""}${save.statistic}` });
  return {
    name: s.name,
    img: s.img,
    rank: sys.level?.value ?? 1,
    glyph: spellGlyph(sys.time?.value),
    traits,
    meta,
    descriptionHtml: sys.description?.value ?? "",
  };
}
