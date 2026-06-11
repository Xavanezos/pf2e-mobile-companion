import { Modal } from "./parts/Modal";
import type { ConditionView } from "../../foundry/actor/types";

/** Player-applicable PF2e conditions. `valued` ones support +/-. */
const CONDITIONS: { slug: string; label: string; valued: boolean }[] = [
  { slug: "blinded", label: "Blinded", valued: false },
  { slug: "clumsy", label: "Clumsy", valued: true },
  { slug: "concealed", label: "Concealed", valued: false },
  { slug: "confused", label: "Confused", valued: false },
  { slug: "controlled", label: "Controlled", valued: false },
  { slug: "dazzled", label: "Dazzled", valued: false },
  { slug: "deafened", label: "Deafened", valued: false },
  { slug: "doomed", label: "Doomed", valued: true },
  { slug: "drained", label: "Drained", valued: true },
  { slug: "encumbered", label: "Encumbered", valued: false },
  { slug: "enfeebled", label: "Enfeebled", valued: true },
  { slug: "fascinated", label: "Fascinated", valued: false },
  { slug: "fatigued", label: "Fatigued", valued: false },
  { slug: "fleeing", label: "Fleeing", valued: false },
  { slug: "frightened", label: "Frightened", valued: true },
  { slug: "grabbed", label: "Grabbed", valued: false },
  { slug: "immobilized", label: "Immobilized", valued: false },
  { slug: "invisible", label: "Invisible", valued: false },
  { slug: "off-guard", label: "Off-Guard", valued: false },
  { slug: "paralyzed", label: "Paralyzed", valued: false },
  { slug: "petrified", label: "Petrified", valued: false },
  { slug: "prone", label: "Prone", valued: false },
  { slug: "quickened", label: "Quickened", valued: false },
  { slug: "restrained", label: "Restrained", valued: false },
  { slug: "sickened", label: "Sickened", valued: true },
  { slug: "slowed", label: "Slowed", valued: true },
  { slug: "stunned", label: "Stunned", valued: true },
  { slug: "stupefied", label: "Stupefied", valued: true },
  { slug: "unconscious", label: "Unconscious", valued: false },
];

export function ConditionsModal({ active, onToggle, onAdjust, onClose }: {
  active: ConditionView[];
  onToggle: (slug: string) => void;
  onAdjust: (slug: string, delta: 1 | -1) => void;
  onClose: () => void;
}) {
  const bySlug = new Map(active.map((c) => [c.slug, c]));
  return (
    <Modal title="Conditions" onClose={onClose}>
      <div className="grid grid-cols-1 gap-1">
        {CONDITIONS.map((c) => {
          const on = bySlug.get(c.slug);
          return (
            <div key={c.slug} className={`flex items-center justify-between rounded-md px-3 py-2 ${on ? "bg-orange-900/40" : "bg-zinc-800"}`}>
              <button onClick={() => onToggle(c.slug)} className="flex-1 text-left text-sm font-medium">
                {c.label}{on?.value != null ? <span className="ml-1 text-orange-300">{on.value}</span> : null}
              </button>
              {on && c.valued && (
                <div className="flex items-center gap-2">
                  <button onClick={() => onAdjust(c.slug, -1)} aria-label={`Decrease ${c.label}`} className="flex h-8 w-8 items-center justify-center rounded bg-zinc-700"><i className="fas fa-minus text-xs" /></button>
                  <button onClick={() => onAdjust(c.slug, 1)} aria-label={`Increase ${c.label}`} className="flex h-8 w-8 items-center justify-center rounded bg-zinc-700"><i className="fas fa-plus text-xs" /></button>
                </div>
              )}
              {on && <button onClick={() => onToggle(c.slug)} aria-label={`Remove ${c.label}`} className="ml-2 flex h-8 w-8 items-center justify-center rounded bg-zinc-700"><i className="fas fa-xmark text-xs" /></button>}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
