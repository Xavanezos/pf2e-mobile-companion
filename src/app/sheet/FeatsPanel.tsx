import type { CharacterView } from "../../foundry/actor/types";
import { ActionGlyph } from "./parts/ActionGlyph";

export function FeatsPanel({ view }: { view: CharacterView }) {
  if (view.featGroups.length === 0) return <div className="p-4 text-sm text-zinc-500">No feats or features.</div>;
  return (
    <div>
      {view.featGroups.map((g) => (
        <section key={g.key}>
          <h3 className="bg-zinc-900/60 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500">{g.label}</h3>
          <div className="divide-y divide-zinc-800">
            {g.feats.map((f) => (
              <div key={f.id} className="flex items-center gap-2 px-3 py-2">
                {f.img && <img src={f.img} alt="" className="h-7 w-7 rounded object-cover" />}
                <span className="min-w-0 flex-1 truncate text-sm">{f.name}</span>
                <span className="text-[10px] text-zinc-500">Lv {f.level}</span>
                <ActionGlyph code={f.actionGlyph} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
