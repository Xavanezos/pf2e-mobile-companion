import type { CharacterView } from "../../foundry/actor/types";
import { Chip } from "./parts/Chip";
import { Pips } from "./parts/Pips";

export function VitalsHeader({ header, conditions, onHpTap, onHeroAdjust, onDyingAdjust, onWoundedAdjust, onConditionTap, onConditionAdd, onSwitch }: {
  header: CharacterView["header"];
  conditions: CharacterView["conditions"];
  onHpTap?: () => void;
  onHeroAdjust?: (delta: 1 | -1) => void;
  onDyingAdjust?: (delta: 1 | -1) => void;
  onWoundedAdjust?: (delta: 1 | -1) => void;
  onConditionTap?: (slug: string) => void;
  onConditionAdd?: () => void;
  onSwitch?: () => void;
}) {
  const hpPct = header.hp.max ? Math.round((header.hp.value / header.hp.max) * 100) : 0;
  return (
    <header className="shrink-0 border-b border-zinc-800 bg-zinc-900 px-3 pb-2 pt-2">
      {/* identity + hero points */}
      <div className="flex items-center gap-2">
        {header.img && <img src={header.img} alt="" className="h-9 w-9 rounded object-cover" />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-bold">{header.name}</span>
            {onSwitch && (
              <button onClick={onSwitch} aria-label="Switch character" className="text-zinc-400">
                <i className="fas fa-right-left text-xs" aria-hidden="true" />
              </button>
            )}
          </div>
          <div className="truncate text-[11px] text-zinc-400">L{header.level} {header.ancestryClassLine}</div>
        </div>
        <Pips value={header.heroPoints.value} max={header.heroPoints.max} label="Hero" onAdjust={onHeroAdjust} />
      </div>

      {/* HP bar + dying/wounded */}
      <div className="mt-2 flex items-center gap-3">
        <button
          onClick={onHpTap}
          disabled={!onHpTap}
          className="min-w-0 flex-1 text-left"
          aria-label="Edit hit points"
        >
          <div className="flex justify-between text-[11px]">
            <span>HP {header.hp.value} / {header.hp.max}{header.hp.temp ? <span className="text-sky-300"> +{header.hp.temp}</span> : null}</span>
          </div>
          <div className="mt-0.5 h-2 overflow-hidden rounded bg-zinc-700">
            <div className="h-full bg-emerald-500" style={{ width: `${hpPct}%` }} />
          </div>
        </button>
        {header.dying.value > 0 && <Pips value={header.dying.value} max={header.dying.max} label="Dying" onAdjust={onDyingAdjust} />}
        {header.wounded > 0 && <Pips value={header.wounded} max={Math.max(header.wounded, 3)} label="Wnd" onAdjust={onWoundedAdjust} />}
      </div>

      {/* reference strip */}
      <div className="mt-2 flex flex-wrap gap-1">
        <Chip>AC {header.ac}</Chip>
        <Chip>Per {header.perceptionMod >= 0 ? "+" : ""}{header.perceptionMod}</Chip>
        <Chip>Spd {header.speed}</Chip>
      </div>

      {/* conditions */}
      {(conditions.length > 0 || onConditionAdd) && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {conditions.map((c) => (
            <Chip key={c.slug} tone="warn" onClick={onConditionTap ? () => onConditionTap(c.slug) : undefined}>
              {c.name}{c.value != null ? ` ${c.value}` : ""}{c.locked ? " 🔒" : ""}
            </Chip>
          ))}
          {onConditionAdd && (
            <button onClick={onConditionAdd} aria-label="Add condition" className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-800 text-zinc-300">
              <i className="fas fa-plus text-xs" aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </header>
  );
}
