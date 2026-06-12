import { Modal } from "../sheet/parts/Modal";
import { initiativeOptions } from "../../foundry/actor/view";
import { rollInitiativeWith } from "../../foundry/combat/actions";
import type { CharacterLike, InitiativeOption } from "../../foundry/actor/types";

/** Read the live actor's initiative statistic options (Perception + every skill,
 *  reusing the sheet's builder) and the current default. Lazy live read by id,
 *  same pattern as `DetailModal`. */
function readPicker(actorId: string): { options: InitiativeOption[]; current: string } | null {
  const actor = (game as any)?.actors?.get(actorId);
  if (!actor) return null;
  return {
    options: initiativeOptions(actor as CharacterLike),
    current: actor.system?.initiative?.statistic ?? "perception",
  };
}

/** Tap "Roll Initiative" → choose which statistic to roll. PF2e rolls initiative
 *  with one configured statistic at a time (set on the sheet); picking here sets
 *  it and rolls (via `rollInitiativeWith`, which skips the hidden Foundry dialog).
 *  The PF2e check card posts to the chat feed; the modal closes on choice. */
export function InitiativePickerModal({ actorId, combatantId, onClose }: {
  actorId: string;
  combatantId: string;
  onClose: () => void;
}) {
  const picker = readPicker(actorId);
  if (!picker) {
    return (
      <Modal title="Roll Initiative" onClose={onClose}>
        <div className="text-sm text-zinc-500">Character unavailable.</div>
      </Modal>
    );
  }
  return (
    <Modal title="Roll Initiative" onClose={onClose}>
      <div className="mb-2 text-xs text-zinc-400">Choose a statistic to roll for initiative.</div>
      <div className="flex flex-col gap-1.5">
        {picker.options.map((o) => {
          const isDefault = o.value === picker.current;
          return (
            <button
              key={o.value}
              onClick={() => { void rollInitiativeWith(actorId, combatantId, o.value); onClose(); }}
              className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                isDefault ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-100"
              }`}
            >
              <span>{o.label}</span>
              {isDefault && <span className="text-[10px] uppercase tracking-wide text-indigo-100">Default</span>}
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
