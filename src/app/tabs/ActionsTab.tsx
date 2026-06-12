import { useState } from "react";
import { useAppStore } from "../store";
import { useStrikes } from "../actions/useStrikes";
import { StrikeCard } from "../actions/StrikeCard";
import { StrikeAttackModal } from "../actions/StrikeAttackModal";
import { StrikeDamageModal } from "../actions/StrikeDamageModal";
import {
  rollStrikeAttack,
  rollStrikeDamage,
  rollStrikeCritical,
  runAuxiliaryAction,
  previewStrikeDamage,
  previewStrikeAttack,
  setStrikeAmmo,
} from "../../foundry/actor/strikeActions";
import type { StrikeView } from "../../foundry/actor/types";

type Section = "strikes" | "actions";
const SECTIONS: { id: Section; label: string }[] = [
  { id: "strikes", label: "Strikes" },
  { id: "actions", label: "Actions" },
];

type Prompt = { strike: StrikeView; kind: "attack" | "damage" | "crit"; variantIndex: number };

/** The bottom Actions tab — mirrors PF2e's char-sheet Actions tab. Strikes section:
 *  cards open roll prompts (attack breakdown / damage formula) before rolling, and
 *  expose auxiliary actions + a ranged ammunition selector. Actions list + toggles
 *  land in Slice B. */
export function ActionsTab() {
  const actorId = useAppStore((s) => s.actorId);
  const [section, setSection] = useState<Section>("strikes");
  const [prompt, setPrompt] = useState<Prompt | null>(null);
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
              onAttack={(vi) => setPrompt({ strike: s, kind: "attack", variantIndex: vi })}
              onDamage={() => setPrompt({ strike: s, kind: "damage", variantIndex: 0 })}
              onCritical={() => setPrompt({ strike: s, kind: "crit", variantIndex: 0 })}
              onAux={(ai) => void runAuxiliaryAction(actorId, s.index, ai)}
              onSetAmmo={(id) => void setStrikeAmmo(actorId, s.index, id)}
            />
          ))
        ))}

      {section === "actions" && (
        <div className="p-4 text-sm text-zinc-500">Actions list &amp; toggles — coming next (Slice B).</div>
      )}

      {prompt?.kind === "attack" && (
        <StrikeAttackModal
          strike={prompt.strike}
          variantIndex={prompt.variantIndex}
          loadPreview={(disabled) => previewStrikeAttack(actorId, prompt.strike.index, prompt.variantIndex, disabled)}
          onRoll={(disabled) =>
            void rollStrikeAttack(actorId, prompt.strike.index, prompt.variantIndex, { disabledSlugs: disabled })
          }
          onClose={() => setPrompt(null)}
        />
      )}
      {(prompt?.kind === "damage" || prompt?.kind === "crit") && (
        <StrikeDamageModal
          title={prompt.strike.label}
          rollLabel={prompt.kind === "crit" ? "Roll Critical" : "Roll Damage"}
          loadFormula={() => previewStrikeDamage(actorId, prompt.strike.index, prompt.kind === "crit")}
          onRoll={() =>
            void (prompt.kind === "crit"
              ? rollStrikeCritical(actorId, prompt.strike.index)
              : rollStrikeDamage(actorId, prompt.strike.index))
          }
          onClose={() => setPrompt(null)}
        />
      )}
    </div>
  );
}
