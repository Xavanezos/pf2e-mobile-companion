import type { CharacterView } from "../../foundry/actor/types";
import { StatRow } from "./parts/StatRow";
import { RankPip } from "./parts/RankPip";
import type { BreakdownRequest } from "./BreakdownModal";

const sign = (n: number) => `${n >= 0 ? "+" : ""}${n}`;

export function SkillsPanel({ view, onShowBreakdown }: { view: CharacterView; onShowBreakdown: (req: BreakdownRequest) => void }) {
  return (
    <div className="divide-y divide-zinc-800 px-3">
      {view.skills.map((s) => (
        <StatRow
          key={s.slug}
          label={
            <span className="flex items-center gap-1">
              {s.label}
              {s.lore && <span className="text-[10px] uppercase text-zinc-500">lore</span>}
              {s.armor && <i className="fas fa-shield-halved text-[9px] text-zinc-600" title="armor check penalty" aria-hidden="true" />}
            </span>
          }
          value={sign(s.mod)}
          right={<RankPip rank={s.rank} />}
          onClick={() => onShowBreakdown({ title: s.label, total: s.mod, parts: s.breakdown ?? [], roll: { kind: "skill", slug: s.slug } })}
        />
      ))}
    </div>
  );
}
