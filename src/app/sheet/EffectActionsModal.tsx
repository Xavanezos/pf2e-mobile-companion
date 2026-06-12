import { Modal } from "./parts/Modal";
import type { EffectView } from "../../foundry/actor/types";

/** Small popup opened by long-pressing an effect chip: remove the effect from
 *  the character. `onRemove` performs the deletion; the modal closes itself. */
export function EffectActionsModal({ effect, onRemove, onClose }: {
  effect: EffectView;
  onRemove: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      title={
        <span className="flex items-center gap-2">
          {effect.img && <img src={effect.img} alt="" className="h-6 w-6 rounded object-cover" />}
          <span className="truncate">{effect.name}{effect.badge ? ` ${effect.badge}` : ""}</span>
        </span>
      }
      onClose={onClose}
    >
      <button
        onClick={() => { onRemove(); onClose(); }}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-red-900/70 px-3 text-sm font-semibold text-red-100"
      >
        <i className="fas fa-trash" aria-hidden="true" />
        Remove effect
      </button>
    </Modal>
  );
}
