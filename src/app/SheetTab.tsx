import { useCallback, useEffect, useState } from "react";
import { useAppStore } from "./store";
import { resolveCharacter, type CharacterResolution, type MinimalGame } from "../foundry/character";
import { useFoundryHook } from "./useFoundryHook";

function readGame(): MinimalGame {
  return game as unknown as MinimalGame;
}

export function SheetTab() {
  const actorId = useAppStore((s) => s.actorId);
  const setActorId = useAppStore((s) => s.setActorId);

  const [resolution, setResolution] = useState<CharacterResolution>(() => resolveCharacter(readGame()));
  const recompute = useCallback(() => setResolution(resolveCharacter(readGame())), []);
  useFoundryHook("updateUser", recompute);

  // Auto-select when the system resolves a single/assigned character.
  useEffect(() => {
    if (resolution.kind === "resolved") setActorId(resolution.actorId);
  }, [resolution, setActorId]);

  if (actorId) {
    const actor = (game as any).actors.get(actorId);
    return (
      <div className="flex flex-col items-center gap-3 p-4">
        {actor?.img && (
          <img src={actor.img} alt="" className="h-28 w-28 rounded-lg object-cover" />
        )}
        <div className="text-xl font-semibold">{actor?.name ?? "Unknown actor"}</div>
        <div className="rounded bg-zinc-800 px-3 py-2 text-sm text-zinc-400">
          Live character sheet arrives in Phase 2.
        </div>
        {resolution.kind === "picker" && (
          <button className="text-sm text-indigo-400 underline" onClick={() => setActorId(null)}>
            Switch character
          </button>
        )}
      </div>
    );
  }

  if (resolution.kind === "picker") {
    return (
      <div className="flex flex-col gap-2 p-4">
        <div className="text-sm text-zinc-400">Choose your character:</div>
        {resolution.candidates.map((c) => (
          <button
            key={c.id}
            onClick={() => setActorId(c.id)}
            className="flex items-center gap-3 rounded-lg bg-zinc-800 p-3 text-left"
          >
            {c.img && <img src={c.img} alt="" className="h-10 w-10 rounded object-cover" />}
            <span className="font-medium">{c.name}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-zinc-400">
      <i className="fas fa-user-slash text-3xl" aria-hidden="true" />
      <div>No character to show.</div>
      <div className="text-sm">Ask your GM to give you ownership of a character actor.</div>
    </div>
  );
}
