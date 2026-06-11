import type { ActorSummary } from "../foundry/character";

export function CharacterPicker({ candidates, currentId, onPick, onCancel }: {
  candidates: ActorSummary[];
  currentId: string | null;
  onPick: (id: string) => void;
  onCancel?: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-zinc-400">Choose your character</div>
        {onCancel && (
          <button onClick={onCancel} aria-label="Back" className="flex h-9 w-9 items-center justify-center text-zinc-400">
            <i className="fas fa-xmark" aria-hidden="true" />
          </button>
        )}
      </div>
      {candidates.map((c) => (
        <button
          key={c.id}
          onClick={() => onPick(c.id)}
          className={`flex items-center gap-3 rounded-lg p-3 text-left ${
            c.id === currentId ? "bg-indigo-600/30 ring-1 ring-indigo-500" : "bg-zinc-800"
          }`}
        >
          {c.img && <img src={c.img} alt="" className="h-10 w-10 rounded object-cover" />}
          <span className="font-medium">{c.name}</span>
          {c.id === currentId && <i className="fas fa-check ml-auto text-indigo-300" aria-hidden="true" />}
        </button>
      ))}
    </div>
  );
}
