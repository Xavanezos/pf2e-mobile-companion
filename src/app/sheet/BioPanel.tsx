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

export function BioPanel({ view }: { view: CharacterView }) {
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
      {(b.attacks.length > 0 || b.defenses.length > 0) && (
        <Section title="Proficiencies">
          {b.attacks.map((p, i) => <StatRow key={`a${i}`} label={p.label} value="" right={<RankPip rank={p.rank} />} />)}
          {b.defenses.map((p, i) => <StatRow key={`d${i}`} label={p.label} value="" right={<RankPip rank={p.rank} />} />)}
        </Section>
      )}
      {b.appearance && (
        <Section title="Appearance"><div className="text-sm leading-relaxed text-zinc-300" dangerouslySetInnerHTML={{ __html: b.appearance }} /></Section>
      )}
      {b.backstory && (
        <Section title="Backstory"><div className="text-sm leading-relaxed text-zinc-300" dangerouslySetInnerHTML={{ __html: b.backstory }} /></Section>
      )}
    </div>
  );
}
