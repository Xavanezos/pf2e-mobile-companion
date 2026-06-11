import { useState } from "react";
import { useSpells } from "./useSpells";
import { SpellEntryCard } from "./spells/SpellEntryCard";
import { SpellDetailModal } from "./spells/SpellDetailModal";
import { castSpell } from "../../foundry/spells/cast";
import type { SpellEntryView, SpellRowView } from "../../foundry/spells/types";

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

  const onCast = (entry: SpellEntryView, spell: SpellRowView) =>
    void castSpell(actorId, entry.id, spell.id, { rank: spell.castRank, slotId: spell.slotIndex });

  if (view === null) return <div className="p-4 text-sm text-zinc-500">Loading spells…</div>;

  const empty = view.entries.length === 0 && view.rituals.length === 0 && view.activations.length === 0;
  if (empty) return <div className="p-4 text-sm text-zinc-500">No spellcasting.</div>;

  return (
    <div>
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
          view.entries.map((e) => <SpellEntryCard key={e.id} entry={e} onCast={onCast} onDetail={setDetailSpellId} />)
        ))}

      {section === "rituals" && <div className="p-4 text-sm text-zinc-500">No rituals.</div>}
      {section === "activations" && <div className="p-4 text-sm text-zinc-500">No activations.</div>}

      {detailSpellId && (
        <SpellDetailModal actorId={actorId} spellId={detailSpellId} onClose={() => setDetailSpellId(null)} />
      )}
    </div>
  );
}
