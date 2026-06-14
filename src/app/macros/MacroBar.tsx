import type { HotbarView } from "../../foundry/macros/types";

/** The pinned macro strip on the Map tab: a horizontal scroll of the player's
 *  hotbar macros (icon + tiny name); tapping runs the macro. An empty hotbar
 *  shows a hint instead. Pinned (`shrink-0`) so it never scrolls away. */
export function MacroBar({ macros, onRun }: { macros: HotbarView; onRun: (id: string) => void }) {
  if (macros.length === 0) {
    return (
      <div className="shrink-0 border-t border-zinc-800 bg-zinc-950 px-3 py-2 text-center text-xs text-zinc-500">
        No macros on your hotbar — add them from the desktop.
      </div>
    );
  }
  return (
    <div className="flex shrink-0 gap-2 overflow-x-auto border-t border-zinc-800 bg-zinc-950 px-2 py-2">
      {macros.map((m) => (
        <button
          key={m.slot}
          onClick={() => onRun(m.id)}
          disabled={!m.canExecute}
          title={m.name}
          className={`flex w-16 shrink-0 flex-col items-center gap-1 ${m.canExecute ? "" : "opacity-40"}`}
        >
          <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg bg-zinc-800 ring-1 ring-zinc-700">
            {m.img ? (
              <img src={m.img} alt="" className="h-full w-full object-cover" />
            ) : (
              <i className="fas fa-scroll text-zinc-400" aria-hidden="true" />
            )}
          </span>
          <span className="w-full truncate text-center text-[10px] leading-tight text-zinc-400">
            {m.name}
          </span>
        </button>
      ))}
    </div>
  );
}
