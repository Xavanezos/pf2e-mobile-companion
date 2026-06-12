import { useState } from "react";
import { Modal } from "../sheet/parts/Modal";
import { rollSpellSave, type SaveMode } from "../../foundry/spells/chatActions";

const MODES: { id: SaveMode; label: string }[] = [
  { id: "normal", label: "Normal" },
  { id: "fortune", label: "Fortune" },
  { id: "misfortune", label: "Misfortune" },
];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Confirm popup for rolling the bound character's save against a spell DC. */
export function SaveRollModal({
  actorId,
  saveType,
  dc,
  messageId,
  onClose,
}: {
  actorId: string;
  saveType: string;
  dc: number;
  messageId?: string;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<SaveMode>("normal");
  const onRoll = () => { void rollSpellSave(actorId, saveType, dc, { mode, messageId }); onClose(); };
  return (
    <Modal title={`${cap(saveType)} Save`} onClose={onClose}>
      <div className="mb-3 text-sm text-zinc-300">
        DC <span className="font-semibold">{dc}</span>
      </div>
      <div className="mb-3 flex gap-1">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium ${
              mode === m.id ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <button
        onClick={onRoll}
        className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white"
      >
        Roll Save
      </button>
    </Modal>
  );
}
