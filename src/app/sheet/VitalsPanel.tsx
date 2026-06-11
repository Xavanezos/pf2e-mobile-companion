import type { ReactNode } from "react";
import type { CharacterView } from "../../foundry/actor/types";
import { StatRow } from "./parts/StatRow";
import { RankPip } from "./parts/RankPip";
import { Chip } from "./parts/Chip";
import type { BreakdownRequest } from "./BreakdownModal";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="px-3 py-2">
      <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500">{title}</h3>
      {children}
    </section>
  );
}
const sign = (n: number) => `${n >= 0 ? "+" : ""}${n}`;

export function VitalsPanel({ view, onInitiativeChange, onShieldHpAdjust, onManageConditions, onShowBreakdown, onShowDetail }: {
  view: CharacterView;
  onInitiativeChange: (statistic: string) => void;
  onShieldHpAdjust: (delta: 1 | -1) => void;
  onManageConditions: () => void;
  onShowBreakdown: (req: BreakdownRequest) => void;
  onShowDetail: (id: string) => void;
}) {
  const d = view.defenses;
  const b = view.bio;
  const lineage: [string, string | undefined][] = [
    ["Ancestry", b.ancestry], ["Heritage", b.heritage], ["Background", b.background],
    ["Class", b.className], ["Deity", b.deity], ["Size", b.size],
  ];
  return (
    <div className="divide-y divide-zinc-800">
      <Section title="Character">
        {lineage.filter(([, v]) => v).map(([k, v]) => <StatRow key={k} label={k} value={v} />)}
      </Section>

      {b.languages.length > 0 && (
        <Section title="Languages"><div className="text-sm text-zinc-300">{b.languages.join(", ")}</div></Section>
      )}

      <Section title="Defenses">
        <StatRow label="Armor Class" value={d.ac} onClick={d.acBreakdown ? () => onShowBreakdown({ title: "Armor Class", total: d.ac, parts: d.acBreakdown!, totalSigned: false }) : undefined} />
        {d.saves.map((s) => <StatRow key={s.slug} label={s.label} value={sign(s.mod)} right={<RankPip rank={s.rank} />} onClick={s.breakdown ? () => onShowBreakdown({ title: s.label, total: s.mod, parts: s.breakdown! }) : undefined} />)}
        <StatRow label="Perception" value={sign(d.perception.mod)} right={<RankPip rank={d.perception.rank} />} onClick={d.perception.breakdown ? () => onShowBreakdown({ title: "Perception", total: d.perception.mod, parts: d.perception.breakdown! }) : undefined} />
        {d.perception.senses.length > 0 && (
          <div className="px-1 pb-2 text-xs text-zinc-400">Senses: {d.perception.senses.map((x) => x.label).join(", ")}</div>
        )}
        <div className="flex min-h-11 items-center justify-between px-1 py-2">
          <span className="text-zinc-300">Initiative</span>
          <div className="flex items-center gap-2">
            <span className="font-semibold tabular-nums">{sign(d.initiative.mod)}</span>
            <select
              value={d.initiative.statistic}
              onChange={(e) => onInitiativeChange(e.target.value)}
              className="rounded-md bg-zinc-800 px-2 py-1 text-sm"
            >
              {d.initiative.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
      </Section>

      {d.shield && (
        <Section title="Shield">
          <StatRow label="Shield AC" value={sign(d.shield.ac)} right={d.shield.broken ? <span className="text-xs text-red-400">broken</span> : d.shield.raised ? <span className="text-xs text-emerald-400">raised</span> : null} />
          <div className="flex min-h-11 items-center justify-between px-1 py-2">
            <span className="text-zinc-300">Shield HP</span>
            <div className="flex items-center gap-2">
              <button onClick={() => onShieldHpAdjust(-1)} aria-label="Shield HP -1" className="flex h-8 w-8 items-center justify-center rounded bg-zinc-700"><i className="fas fa-minus text-xs" /></button>
              <span className="w-16 text-center font-semibold tabular-nums">{d.shield.hp.value} / {d.shield.hp.max}</span>
              <button onClick={() => onShieldHpAdjust(1)} aria-label="Shield HP +1" className="flex h-8 w-8 items-center justify-center rounded bg-zinc-700"><i className="fas fa-plus text-xs" /></button>
            </div>
          </div>
          <StatRow label="Hardness" value={d.shield.hardness} />
        </Section>
      )}

      {d.speeds.length > 0 && (
        <Section title="Speed">{d.speeds.map((s) => <StatRow key={s.type} label={s.label} value={`${s.value} ft`} />)}</Section>
      )}

      {d.classDCs.length > 0 && (
        <Section title="Class DC">{d.classDCs.map((c) => <StatRow key={c.slug} label={c.label} value={c.value} right={c.primary ? <span className="text-[10px] text-zinc-500">primary</span> : null} onClick={c.breakdown ? () => onShowBreakdown({ title: c.label, total: c.value, parts: c.breakdown!, totalSigned: false }) : undefined} />)}</Section>
      )}

      <Section title="Abilities">
        <div className="grid grid-cols-3 gap-2">
          {view.abilities.map((a) => (
            <div key={a.slug} className={`rounded-md bg-zinc-800 p-2 text-center ${a.key ? "ring-1 ring-indigo-500" : ""}`}>
              <div className="text-lg font-bold tabular-nums">{sign(a.mod)}</div>
              <div className="text-[10px] text-zinc-400">{a.label}</div>
            </div>
          ))}
        </div>
      </Section>

      {(view.traits.immunities.length + view.traits.resistances.length + view.traits.weaknesses.length > 0) && (
        <Section title="Defenses & Traits">
          <div className="flex flex-wrap gap-1">
            {view.traits.resistances.map((x, i) => <Chip key={`r${i}`}>Resist {x.label}</Chip>)}
            {view.traits.weaknesses.map((x, i) => <Chip key={`w${i}`} tone="warn">Weak {x.label}</Chip>)}
            {view.traits.immunities.map((x, i) => <Chip key={`i${i}`}>Immune {x.label}</Chip>)}
          </div>
        </Section>
      )}

      <Section title="Conditions & Effects">
        <div className="mb-2 flex flex-wrap gap-1">
          {view.conditions.map((c) => <Chip key={c.slug} tone="warn">{c.name}{c.value != null ? ` ${c.value}` : ""}</Chip>)}
          {view.effects.map((e, i) => <Chip key={`e${i}`} onClick={e.id ? () => onShowDetail(e.id!) : undefined}>{e.name}{e.badge ? ` ${e.badge}` : ""}</Chip>)}
          {view.conditions.length === 0 && view.effects.length === 0 && <span className="text-xs text-zinc-500">None.</span>}
        </div>
        <button onClick={onManageConditions} className="min-h-11 rounded-md bg-zinc-800 px-3 text-sm font-medium text-indigo-300">Manage conditions</button>
      </Section>
    </div>
  );
}
