import type { ActionsView } from "../../foundry/actor/types";
import { ActionGlyph } from "../sheet/parts/ActionGlyph";

/** The Actions segment: grouped rows (Actions / Reactions / Free / Exploration /
 *  Downtime). Each row: img + name (tap → detail) + optional frequency pill + glyph
 *  + a Use button (posts the PF2e action card). Mirrors FeatsPanel's grouped layout. */
export function ActionsList({ groups, onUse, onShowDetail }: {
  groups: ActionsView;
  onUse: (id: string) => void;
  onShowDetail: (id: string) => void;
}) {
  if (groups.length === 0) return <div className="p-4 text-sm text-zinc-500">No actions.</div>;
  return (
    <div>
      {groups.map((g) => (
        <section key={g.key}>
          <h3 className="bg-zinc-900/60 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500">{g.label}</h3>
          <div className="divide-y divide-zinc-800">
            {g.actions.map((a) => (
              <div key={a.id} className="flex items-center gap-2 px-3 py-2">
                {a.img && <img src={a.img} alt="" className="h-7 w-7 rounded object-cover" />}
                <button onClick={() => onShowDetail(a.id)} className="min-w-0 flex-1 truncate text-left text-sm">
                  {a.name}
                </button>
                {a.frequency && (
                  <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400" title="Remaining uses">
                    {a.frequency.value}/{a.frequency.max}
                  </span>
                )}
                <ActionGlyph code={a.glyph} />
                <button
                  onClick={() => onUse(a.id)}
                  className="shrink-0 rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white"
                >
                  Use
                </button>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
