import type {
  ActiveSpellLike,
  SpellcastingActorLike,
  SpellcastingSheetDataLike,
  SpellEntryKind,
  SpellEntryView,
  SpellGroupLike,
  SpellLike,
  SpellRankView,
  SpellRowView,
  SpellsView,
  SpellUsesView,
} from "./types";

/** Action-cost glyph for a spell from its cast time. Longer casts ("1 minute",
 *  rituals) carry no glyph — the row shows the time text instead. */
export function spellGlyph(time: string | undefined): string | null {
  if (!time) return null;
  if (time === "1" || time === "2" || time === "3" || time === "reaction" || time === "free") {
    return time;
  }
  return null;
}

function entryKind(d: SpellcastingSheetDataLike): SpellEntryKind {
  if (d.isFocusPool) return "focus";
  if (d.isInnate) return "innate";
  if (d.isSpontaneous) return "spontaneous";
  return "prepared";
}

function mapRow(a: ActiveSpellLike, rank: number, slotIndex: number | null): SpellRowView {
  const s: SpellLike = a.spell;
  return {
    id: s.id,
    name: s.name,
    img: s.img,
    glyph: spellGlyph(s.system?.time?.value),
    rank,
    castRank: a.castRank ?? rank,
    expended: a.expended ?? false,
    signature: a.signature ?? false,
    atWill: s.atWill ?? s.isCantrip ?? false,
    slotIndex,
  };
}

const rankNumber = (id: "cantrips" | number): number => (id === "cantrips" ? 0 : Number(id));

/** Per-rank "uses" pill. Cantrips/innate are unlimited (null); focus draws on the
 *  shared pool; prepared counts unexpended slots; spontaneous uses its own slots. */
function mapUses(
  d: SpellcastingSheetDataLike,
  g: SpellGroupLike,
  rows: SpellRowView[],
  focusPool: { value: number; max: number } | null,
): SpellUsesView | null {
  if (g.id === "cantrips") return null;
  if (d.isInnate) return null;
  if (d.isFocusPool) return focusPool ? { value: focusPool.value, max: focusPool.max } : null;
  if (d.isPrepared) {
    const max = g.uses?.max ?? g.active.length;
    return { value: rows.filter((r) => !r.expended).length, max };
  }
  if (g.uses) return { value: g.uses.value ?? g.uses.max, max: g.uses.max };
  return null;
}

/** Pure: map one spellcasting entry's sheet data to the view. Prepared slots keep
 *  their index (for casting/clearing); empty slots (null actives) are dropped. */
export function mapSpellcastingEntry(
  d: SpellcastingSheetDataLike,
  focusPool: { value: number; max: number } | null,
): SpellEntryView {
  const prepared = !!d.isPrepared;
  const ranks: SpellRankView[] = d.groups.map((g) => {
    const rank = rankNumber(g.id);
    const rows: SpellRowView[] = [];
    g.active.forEach((a, i) => {
      if (a) rows.push(mapRow(a, rank, prepared ? i : null));
    });
    return { id: String(g.id), label: g.label, uses: mapUses(d, g, rows, focusPool), spells: rows };
  });
  return {
    id: d.id,
    name: d.name,
    kind: entryKind(d),
    tradition: d.tradition ?? null,
    attackMod: d.statistic?.check?.mod ?? null,
    dc: d.statistic?.dc?.value ?? null,
    ranks,
  };
}

function readFocus(actor: SpellcastingActorLike): { value: number; max: number } | null {
  const f = actor.system?.resources?.focus;
  if (!f || f.max == null || f.max <= 0) return null;
  return { value: f.value ?? 0, max: f.max };
}

/** Async glue: build the full spells view from a live actor. Awaits each regular
 *  entry's `getSheetData()`. Rituals + item activations are filled in Slice B. */
export async function buildSpellsView(actor: SpellcastingActorLike): Promise<SpellsView> {
  const focus = readFocus(actor);
  const entries: SpellEntryView[] = [];
  for (const entry of actor.spellcasting ?? []) {
    if (!entry || entry.isRitual || entry.category === "ritual" || entry.category === "items") continue;
    const data = await entry.getSheetData?.();
    if (data) entries.push(mapSpellcastingEntry(data as SpellcastingSheetDataLike, focus));
  }
  return { entries, rituals: [], activations: [], focus };
}
