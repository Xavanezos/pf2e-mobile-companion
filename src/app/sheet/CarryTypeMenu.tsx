import { Modal } from "./parts/Modal";

const CHOICES: { key: string; label: string; carryType: string; handsHeld: number }[] = [
  { key: "worn", label: "Worn", carryType: "worn", handsHeld: 0 },
  { key: "held1", label: "Held (1 hand)", carryType: "held", handsHeld: 1 },
  { key: "held2", label: "Held (2 hands)", carryType: "held", handsHeld: 2 },
  { key: "stowed", label: "Stowed", carryType: "stowed", handsHeld: 0 },
  { key: "dropped", label: "Dropped", carryType: "dropped", handsHeld: 0 },
];

export function CarryTypeMenu({ itemName, onSelect, onClose }: {
  itemName: string;
  onSelect: (carryType: string, handsHeld: number) => void;
  onClose: () => void;
}) {
  return (
    <Modal title={`Carry — ${itemName}`} onClose={onClose}>
      <div className="grid gap-1">
        {CHOICES.map((c) => (
          <button key={c.key} onClick={() => { onSelect(c.carryType, c.handsHeld); onClose(); }}
            className="min-h-12 rounded-md bg-zinc-800 px-3 text-left text-sm font-medium">
            {c.label}
          </button>
        ))}
      </div>
    </Modal>
  );
}
