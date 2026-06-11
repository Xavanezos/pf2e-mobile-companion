import type { ReactNode } from "react";
import type { CharacterView } from "../../foundry/actor/types";
import { StatRow } from "./parts/StatRow";
import { RankPip } from "./parts/RankPip";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="px-3 py-2">
      <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500">{title}</h3>
      {children}
    </section>
  );
}

export function ProfsPanel({ view }: { view: CharacterView }) {
  const b = view.bio;
  if (b.attacks.length === 0 && b.defenses.length === 0) {
    return <div className="p-4 text-sm text-zinc-500">No proficiencies.</div>;
  }
  return (
    <div className="divide-y divide-zinc-800">
      {b.attacks.length > 0 && (
        <Section title="Weapon Proficiencies">
          {b.attacks.map((p, i) => <StatRow key={`a${i}`} label={p.label} value="" right={<RankPip rank={p.rank} />} />)}
        </Section>
      )}
      {b.defenses.length > 0 && (
        <Section title="Armor Proficiencies">
          {b.defenses.map((p, i) => <StatRow key={`d${i}`} label={p.label} value="" right={<RankPip rank={p.rank} />} />)}
        </Section>
      )}
    </div>
  );
}
