import { Modal } from "../sheet/parts/Modal";
import { rollSpellDamage, buildSpellBaseDamage } from "../../foundry/spells/chatActions";

/** Confirm popup for rolling a cast spell's damage. PF2e v8.2 spells have a single
 *  damage roll (no critical); we show the base dice and trigger PF2e's own roll. */
export function DamageRollModal({ messageId, onClose }: { messageId: string; onClose: () => void }) {
  const spell = (game as any)?.messages?.get(messageId)?.item;
  const name: string = spell?.name ?? "Spell";
  const damage = buildSpellBaseDamage(spell?.system?.damage);
  const onRoll = () => { void rollSpellDamage(messageId); onClose(); };
  return (
    <Modal title={name} onClose={onClose}>
      {damage && (
        <div className="mb-3 text-sm text-zinc-300">
          Damage: <span className="font-semibold">{damage}</span>
        </div>
      )}
      <button
        onClick={onRoll}
        className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white"
      >
        Roll Damage
      </button>
    </Modal>
  );
}
