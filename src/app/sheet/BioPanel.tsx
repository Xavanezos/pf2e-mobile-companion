import type { ReactNode } from "react";
import type { CharacterView } from "../../foundry/actor/types";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="px-3 py-2">
      <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500">{title}</h3>
      {children}
    </section>
  );
}

/** Prose only — lineage/languages live in Vitals, proficiencies in the Profs tab. */
export function BioPanel({ view }: { view: CharacterView }) {
  const b = view.bio;
  if (!b.appearance && !b.backstory) {
    return <div className="p-4 text-sm text-zinc-500">No biography.</div>;
  }
  return (
    <div className="divide-y divide-zinc-800">
      {b.appearance && (
        <Section title="Appearance"><div className="text-sm leading-relaxed text-zinc-300" dangerouslySetInnerHTML={{ __html: b.appearance }} /></Section>
      )}
      {b.backstory && (
        <Section title="Backstory"><div className="text-sm leading-relaxed text-zinc-300" dangerouslySetInnerHTML={{ __html: b.backstory }} /></Section>
      )}
    </div>
  );
}
