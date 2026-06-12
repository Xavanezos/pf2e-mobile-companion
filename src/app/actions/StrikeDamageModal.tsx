import { useEffect, useState } from "react";
import { Modal } from "../sheet/parts/Modal";

/** Damage/crit roll prompt. Source-agnostic: the caller supplies a formula loader
 *  (PF2e's getFormula) and a roll trigger, so the Actions tab and the chat attack
 *  card share it. Mirrors the spell DamageRollModal. */
export function StrikeDamageModal({
  title,
  rollLabel = "Roll Damage",
  loadFormula,
  onRoll,
  onClose,
}: {
  title: string;
  rollLabel?: string;
  loadFormula: () => Promise<string | null>;
  onRoll: () => void;
  onClose: () => void;
}) {
  const [formula, setFormula] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    loadFormula().then((f) => { if (alive) setFormula(f); }).catch(() => {});
    return () => { alive = false; };
    // Runs once per open; loadFormula closes over the chosen strike/message.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const roll = () => { onRoll(); onClose(); };
  return (
    <Modal title={title} onClose={onClose}>
      {formula && (
        <div className="mb-3 text-sm text-zinc-300">
          Damage: <span className="font-semibold">{formula}</span>
        </div>
      )}
      <button onClick={roll} className="min-h-12 w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white">
        {rollLabel}
      </button>
    </Modal>
  );
}
