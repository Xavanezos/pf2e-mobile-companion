import type { StrikeView } from "../../foundry/actor/types";
import { ActionGlyph } from "../sheet/parts/ActionGlyph";

/** One strike: img + name + action glyph + ready dot, traits line, three MAP
 *  attack buttons (labels straight from PF2e), then Damage + Crit. Solid `bg-*`
 *  fills (never `border`) per the Tailwind-v4 button gotchas; dimmed when not
 *  ready. */
export function StrikeCard({
  strike,
  onAttack,
  onDamage,
  onCritical,
}: {
  strike: StrikeView;
  onAttack: (variantIndex: number) => void;
  onDamage: () => void;
  onCritical: () => void;
}) {
  return (
    <section className={`border-b border-zinc-800 px-3 py-2 ${strike.ready ? "" : "opacity-50"}`}>
      <div className="flex items-center gap-2">
        {strike.img && <img src={strike.img} alt="" className="h-7 w-7 rounded object-cover" />}
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{strike.label}</span>
        <ActionGlyph code={strike.glyph} />
        <span
          className={`shrink-0 text-[10px] font-medium ${strike.ready ? "text-emerald-400" : "text-zinc-500"}`}
          title={strike.ready ? "Ready" : "Not equipped"}
        >
          {strike.ready ? "● ready" : "○ not ready"}
        </span>
      </div>

      {strike.traits.length > 0 && (
        <div className="mt-0.5 truncate text-[11px] capitalize text-zinc-400">{strike.traits.join(", ")}</div>
      )}

      <div className="mt-2 flex items-center gap-2">
        <span className="shrink-0 text-[11px] uppercase tracking-wide text-zinc-500">Attack</span>
        {strike.variants.map((v, i) => (
          <button
            key={i}
            onClick={() => onAttack(i)}
            className="flex-1 rounded-md bg-indigo-600 px-2 py-1.5 text-sm font-semibold text-white"
          >
            {v.label}
          </button>
        ))}
      </div>

      {(strike.hasDamage || strike.hasCritical) && (
        <div className="mt-2 flex gap-2">
          {strike.hasDamage && (
            <button
              onClick={onDamage}
              className="flex-1 rounded-md bg-zinc-700 px-2 py-1.5 text-sm font-medium text-zinc-100"
            >
              Damage
            </button>
          )}
          {strike.hasCritical && (
            <button
              onClick={onCritical}
              className="flex-1 rounded-md bg-amber-700 px-2 py-1.5 text-sm font-medium text-amber-50"
            >
              Crit
            </button>
          )}
        </div>
      )}
    </section>
  );
}
