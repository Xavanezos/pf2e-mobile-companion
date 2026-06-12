import { Modal } from "../sheet/parts/Modal";
import type { StrikeView } from "../../foundry/actor/types";

const sign = (n: number) => `${n >= 0 ? "+" : ""}${n}`;

/** Attack roll prompt: the strike's modifier breakdown + the chosen MAP variant's
 *  total + a Roll button. Read-only in A.2a; per-modifier toggles arrive in A.2b. */
export function StrikeAttackModal({
  strike,
  variantIndex,
  onRoll,
  onClose,
}: {
  strike: StrikeView;
  variantIndex: number;
  onRoll: () => void;
  onClose: () => void;
}) {
  const variant = strike.variants[variantIndex];
  const roll = () => { onRoll(); onClose(); };
  return (
    <Modal title={strike.label} onClose={onClose}>
      <div className="divide-y divide-zinc-800">
        {strike.modifiers.map((m, i) => (
          <div key={i} className={`flex items-center justify-between px-1 py-2 text-sm ${m.enabled ? "" : "opacity-40"}`}>
            <span className="text-zinc-300">{m.label}</span>
            <span className="font-semibold tabular-nums">{sign(m.value)}</span>
          </div>
        ))}
        {variant.penalty !== 0 && (
          <div className="flex items-center justify-between px-1 py-2 text-sm">
            <span className="text-zinc-300">Multiple Attack Penalty</span>
            <span className="font-semibold tabular-nums">{variant.penalty}</span>
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between border-t-2 border-zinc-700 px-1 pt-2">
        <span className="font-semibold">Attack</span>
        <span className="text-lg font-bold tabular-nums">{variant.label}</span>
      </div>
      <button onClick={roll} className="mt-3 min-h-12 w-full rounded-md bg-indigo-600 font-semibold text-white">
        Roll {variant.label}
      </button>
    </Modal>
  );
}
