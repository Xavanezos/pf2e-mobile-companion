import { useAppStore } from "../store";
import { useEncounter } from "./useEncounter";
import { CombatantRow } from "./CombatantRow";

/** The Combat tab — a live, player-facing initiative tracker mirroring what the
 *  stock encounter tracker shows a player. Render-only here; the Roll Initiative
 *  / End My Turn controls are wired in Task 3. */
export function CombatTab() {
  const actorId = useAppStore((s) => s.actorId);
  const encounter = useEncounter(actorId);

  if (!encounter) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-zinc-500">
        <i className="fas fa-dice-d20 text-3xl" aria-hidden="true" />
        <div className="text-sm">No active encounter.</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900 px-3 py-2">
        <span className="text-sm font-semibold text-zinc-200">
          {encounter.started ? `Round ${encounter.round}` : "Not started"}
        </span>
        {encounter.isMyTurn && (
          <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-semibold text-white">Your turn</span>
        )}
      </header>
      <div className="min-h-0 flex-1 divide-y divide-zinc-800 overflow-y-auto">
        {encounter.combatants.length === 0 ? (
          <div className="p-4 text-sm text-zinc-500">No combatants.</div>
        ) : (
          encounter.combatants.map((c) => <CombatantRow key={c.id} c={c} />)
        )}
      </div>
    </div>
  );
}
