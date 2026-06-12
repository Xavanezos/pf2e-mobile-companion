import { useState } from "react";
import { useSpells } from "./useSpells";
import { SpellEntryCard } from "./spells/SpellEntryCard";
import { SpellRow } from "./spells/SpellRow";
import { SpellDetailModal } from "./spells/SpellDetailModal";
import { SpellbookModal } from "./spells/SpellbookModal";
import { PipStepper } from "./parts/PipStepper";
import { castSpell, castRitual, consumeActivation } from "../../foundry/spells/cast";
import { setFocusPoints } from "../../foundry/spells/spellbook";
import type { SpellEntryView, SpellRowView } from "../../foundry/spells/types";
import { loc } from "../../foundry/i18n";

type Section = "known" | "rituals" | "activations";
const SECTIONS: { id: Section; label: string }[] = [
  { id: "known", label: "Known Spells" },
  { id: "rituals", label: "Rituals" },
  { id: "activations", label: "Activations" },
];

/** The Spells sub-tab — mirrors PF2e's Spellcasting tab: a segmented control over
 *  Known Spells / Rituals / Activations. (Rituals + Activations land in Slice B.) */
export function SpellsPanel({ actorId }: { actorId: string }) {
  const view = useSpells(actorId);
  const [section, setSection] = useState<Section>("known");
  const [detailSpellId, setDetailSpellId] = useState<string | null>(null);
  const [spellbookEntryId, setSpellbookEntryId] = useState<string | null>(null);

  const onCast = (entry: SpellEntryView, spell: SpellRowView) =>
    void castSpell(actorId, entry.id, spell.id, { rank: spell.castRank, slotId: spell.slotIndex });

  const focus = view?.focus ?? null;
  const onFocusAdjust = (d: 1 | -1) => {
    if (!focus) return;
    void setFocusPoints(actorId, Math.max(0, Math.min(focus.max, focus.value + d)));
  };

  if (view === null) return <div className="p-4 text-sm text-zinc-500">Loading spells…</div>;

  const empty = view.entries.length === 0 && view.ritualRanks.length === 0 && view.activations.length === 0;
  if (empty) return <div className="p-4 text-sm text-zinc-500">No spellcasting.</div>;

  return (
    <div>
      {focus && (
        <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-3 py-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Focus Points</span>
          <PipStepper value={focus.value} max={focus.max} onAdjust={onFocusAdjust} />
        </div>
      )}
      <nav className="flex gap-1 overflow-x-auto border-b border-zinc-800 bg-zinc-950 px-2 py-1">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`min-h-9 whitespace-nowrap rounded-md px-3 text-xs font-medium ${
              section === s.id ? "bg-indigo-600 text-white" : "text-zinc-400"
            }`}
          >
            {s.label}
          </button>
        ))}
      </nav>

      {section === "known" &&
        (view.entries.length === 0 ? (
          <div className="p-4 text-sm text-zinc-500">No spells known.</div>
        ) : (
          view.entries.map((e) => (
            <SpellEntryCard
              key={e.id}
              entry={e}
              onCast={onCast}
              onDetail={setDetailSpellId}
              onSpellbook={(en) => setSpellbookEntryId(en.id)}
            />
          ))
        ))}

      {section === "rituals" &&
        (view.ritualRanks.length === 0 ? (
          <div className="p-4 text-sm text-zinc-500">No rituals.</div>
        ) : (
          view.ritualRanks.map((r) => (
            <div key={r.id}>
              <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500">{loc(r.label)}</div>
              <div className="divide-y divide-zinc-800">
                {r.spells.map((s) => (
                  <SpellRow
                    key={s.id}
                    spell={s}
                    onDetail={() => setDetailSpellId(s.id)}
                    onCast={() => void castRitual(actorId, s.id)}
                  />
                ))}
              </div>
            </div>
          ))
        ))}

      {section === "activations" &&
        (view.activations.length === 0 ? (
          <div className="p-4 text-sm text-zinc-500">No activations.</div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {view.activations.map((a) => (
              <div key={a.id} className="flex items-center gap-2 px-3 py-2">
                {a.img && <img src={a.img} alt="" className="h-7 w-7 rounded object-cover" />}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{a.name}</div>
                  {a.spellName && <div className="truncate text-[11px] text-zinc-400">{a.spellName}</div>}
                </div>
                {a.uses && (
                  <span className="shrink-0 text-xs text-zinc-400">
                    {a.uses.value}/{a.uses.max}
                  </span>
                )}
                <button
                  onClick={() => void consumeActivation(actorId, a.id)}
                  className="shrink-0 rounded-md bg-indigo-600 px-3 py-1 text-xs font-semibold text-white"
                >
                  Cast
                </button>
              </div>
            ))}
          </div>
        ))}

      {detailSpellId && (
        <SpellDetailModal actorId={actorId} spellId={detailSpellId} onClose={() => setDetailSpellId(null)} />
      )}
      {spellbookEntryId && (
        <SpellbookModal actorId={actorId} entryId={spellbookEntryId} onClose={() => setSpellbookEntryId(null)} />
      )}
    </div>
  );
}
