import { Modal } from "./parts/Modal";
import type { ModPartView } from "../../foundry/actor/types";
import type { RollTarget } from "../../foundry/actor/rolls";

/** A breakdown request raised by tapping a stat. `totalSigned` false for AC/DCs.
 *  `roll` (skills/saves/perception) makes the modal's Roll button live. */
export interface BreakdownRequest { title: string; total: number; parts: ModPartView[]; totalSigned?: boolean; roll?: RollTarget; }

const sign = (n: number) => `${n >= 0 ? "+" : ""}${n}`;

/** Read-only modifier breakdown. `onRoll` when supplied shows a Roll button;
 *  omitted renders display-only. */
export function BreakdownModal({ req, onClose, onRoll }: {
  req: BreakdownRequest;
  onClose: () => void;
  onRoll?: () => void;
}) {
  const { title, total, parts, totalSigned = true } = req;
  return (
    <Modal title={title} onClose={onClose}>
      {parts.length === 0 ? (
        <div className="text-sm text-zinc-500">No breakdown available.</div>
      ) : (
        <div className="divide-y divide-zinc-800">
          {parts.map((p, i) => (
            <div key={i} className="flex items-center justify-between px-1 py-2 text-sm">
              <span className="text-zinc-300">{p.label}</span>
              <span className="font-semibold tabular-nums">{sign(p.value)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-2 flex items-center justify-between border-t-2 border-zinc-700 px-1 pt-2">
        <span className="font-semibold">Total</span>
        <span className="text-lg font-bold tabular-nums">{totalSigned ? sign(total) : total}</span>
      </div>
      {onRoll && (
        <button onClick={() => { onRoll(); onClose(); }} className="mt-3 min-h-12 w-full rounded-md bg-indigo-600 font-semibold text-white">
          Roll
        </button>
      )}
    </Modal>
  );
}
