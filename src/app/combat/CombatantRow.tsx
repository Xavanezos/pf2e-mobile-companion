import type { CombatantView } from "../../foundry/combat/types";

/** One row in the initiative order: portrait, name, initiative, and an HP bar
 *  when the viewer may see it. The current-turn row is ringed with a ▶ marker;
 *  the active character's own row is tagged "You"; defeated rows are dimmed and
 *  struck. Non-interactive for v1 (tap-for-detail is Phase 7). Uses bg/ring, not
 *  `border`, per the Tailwind-v4 reset gotchas. */
export function CombatantRow({ c }: { c: CombatantView }) {
  const hpPct = c.hp && c.hp.max > 0 ? Math.max(0, Math.min(100, (c.hp.value / c.hp.max) * 100)) : 0;
  const hpColor = hpPct > 50 ? "bg-emerald-500" : hpPct > 25 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 ${
        c.isCurrent ? "bg-indigo-950/60 ring-2 ring-inset ring-indigo-400" : ""
      } ${c.defeated ? "opacity-50" : ""}`}
    >
      <span className="flex w-4 shrink-0 justify-center text-indigo-400">
        {c.isCurrent && <i className="fas fa-caret-right" aria-hidden="true" />}
      </span>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded bg-zinc-800">
        {c.img ? (
          <img src={c.img} alt="" className="h-full w-full object-cover" />
        ) : (
          <i className="fas fa-user text-zinc-500" aria-hidden="true" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className={`truncate text-sm font-medium ${c.defeated ? "text-zinc-500 line-through" : "text-zinc-100"}`}>
            {c.name}
          </span>
          {c.isMine && (
            <span className="shrink-0 rounded bg-indigo-600 px-1 text-[10px] font-semibold text-white">You</span>
          )}
        </span>
        {c.hp && (
          <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <span className={`block h-full ${hpColor}`} style={{ width: `${hpPct}%` }} />
          </span>
        )}
      </span>
      <span className="shrink-0 text-xl font-bold tabular-nums text-zinc-200">{c.initiative ?? "–"}</span>
    </div>
  );
}
