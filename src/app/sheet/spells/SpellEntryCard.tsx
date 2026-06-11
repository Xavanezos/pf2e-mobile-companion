import type { SpellEntryView, SpellRowView } from "../../../foundry/spells/types";
import { SpellRow } from "./SpellRow";

const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

/** A spellcasting entry: header (name, tradition, DC/attack, spellbook button) +
 *  its ranks, each a list of spell rows with a uses pill. */
export function SpellEntryCard({
  entry,
  onCast,
  onDetail,
  onSpellbook,
}: {
  entry: SpellEntryView;
  onCast: (entry: SpellEntryView, spell: SpellRowView) => void;
  onDetail: (spellId: string) => void;
  onSpellbook?: (entry: SpellEntryView) => void;
}) {
  const editable = entry.kind === "prepared" || entry.kind === "spontaneous";
  return (
    <section className="mb-3">
      <header className="flex items-center justify-between gap-2 bg-zinc-900/60 px-3 py-1.5">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{entry.name}</div>
          <div className="text-[11px] text-zinc-400">
            {entry.tradition && <span className="capitalize">{entry.tradition}</span>}
            {entry.dc != null && <span> · DC {entry.dc}</span>}
            {entry.attackMod != null && <span> · {sign(entry.attackMod)} to hit</span>}
          </div>
        </div>
        {onSpellbook && editable && (
          <button
            onClick={() => onSpellbook(entry)}
            className="flex shrink-0 items-center gap-1 rounded-md bg-zinc-700 px-2 py-1 text-[11px] font-medium text-zinc-100"
          >
            <i className="fas fa-book" aria-hidden="true" />
            {entry.kind === "prepared" ? "Prepare" : "Known"}
          </button>
        )}
      </header>
      {entry.ranks.map((r) => (
        <div key={r.id}>
          <div className="flex items-center justify-between px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500">
            <span>{r.label}</span>
            {r.uses && (
              <span className="text-zinc-400">
                {r.uses.value ?? "∞"}/{r.uses.max}
              </span>
            )}
          </div>
          {r.spells.length === 0 ? (
            <div className="px-3 py-1.5 text-xs text-zinc-600">—</div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {r.spells.map((s) => (
                <SpellRow
                  key={`${s.id}-${s.slotIndex ?? "x"}`}
                  spell={s}
                  onDetail={() => onDetail(s.id)}
                  onCast={() => onCast(entry, s)}
                  castDisabled={!s.atWill && (s.expended || r.uses?.value === 0)}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
