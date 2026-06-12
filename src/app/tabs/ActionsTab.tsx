import { useState } from "react";
import { useAppStore } from "../store";
import { useStrikes } from "../actions/useStrikes";
import { StrikeCard } from "../actions/StrikeCard";
import { rollStrikeAttack, rollStrikeDamage, rollStrikeCritical } from "../../foundry/actor/strikeActions";

type Section = "strikes" | "actions";
const SECTIONS: { id: Section; label: string }[] = [
  { id: "strikes", label: "Strikes" },
  { id: "actions", label: "Actions" },
];

/** The bottom Actions tab — mirrors PF2e's char-sheet Actions tab. Slice A: a
 *  segmented Strikes / Actions control with Strikes implemented. The pinned
 *  Toggles strip + the Actions list (Encounter/Exploration/Downtime) land in
 *  Slice B. */
export function ActionsTab() {
  const actorId = useAppStore((s) => s.actorId);
  const [section, setSection] = useState<Section>("strikes");
  const strikes = useStrikes(actorId ?? "");

  if (!actorId) return <div className="p-4 text-sm text-zinc-500">No character selected.</div>;

  return (
    <div>
      <nav className="flex gap-1 overflow-x-auto border-b border-zinc-800 bg-zinc-950 px-2 py-1">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`min-h-9 whitespace-nowrap rounded-md px-3 text-xs font-medium ${
              section === s.id ? "bg-indigo-600 text-white" : "text-zinc-400"
            }`}
          >
            {s.label}
          </button>
        ))}
      </nav>

      {section === "strikes" &&
        (strikes === null ? (
          <div className="p-4 text-sm text-zinc-500">Loading strikes…</div>
        ) : strikes.length === 0 ? (
          <div className="p-4 text-sm text-zinc-500">No strikes.</div>
        ) : (
          strikes.map((s) => (
            <StrikeCard
              key={`${s.slug}-${s.index}`}
              strike={s}
              onAttack={(vi) => void rollStrikeAttack(actorId, s.index, vi)}
              onDamage={() => void rollStrikeDamage(actorId, s.index)}
              onCritical={() => void rollStrikeCritical(actorId, s.index)}
            />
          ))
        ))}

      {section === "actions" && (
        <div className="p-4 text-sm text-zinc-500">Actions list &amp; toggles — coming next (Slice B).</div>
      )}
    </div>
  );
}
