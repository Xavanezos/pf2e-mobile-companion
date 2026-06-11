import { useCallback, useEffect, useState } from "react";
import { useAppStore } from "./store";
import { resolveCharacter, type CharacterResolution, type MinimalGame } from "../foundry/character";
import { useFoundryHook } from "./useFoundryHook";
import { CharacterSheet } from "./sheet/CharacterSheet";
import { CharacterPicker } from "./CharacterPicker";

function readGame(): MinimalGame {
  return game as unknown as MinimalGame;
}

export function SheetTab() {
  const actorId = useAppStore((s) => s.actorId);
  const setActorId = useAppStore((s) => s.setActorId);
  const [picking, setPicking] = useState(false);

  const [resolution, setResolution] = useState<CharacterResolution>(() => resolveCharacter(readGame()));
  const recompute = useCallback(() => setResolution(resolveCharacter(readGame())), []);
  useFoundryHook("updateUser", recompute);
  useFoundryHook("createActor", recompute);
  useFoundryHook("deleteActor", recompute);

  // Initial default selection (assigned, or the sole owned PC). Guarded by `picking`
  // so tapping "switch" can clear the selection without immediately re-selecting.
  useEffect(() => {
    if (!actorId && !picking && resolution.defaultId) setActorId(resolution.defaultId);
  }, [actorId, picking, resolution, setActorId]);

  const pick = useCallback((id: string) => { setActorId(id); setPicking(false); }, [setActorId]);
  const canSwitch = resolution.candidates.length >= 2;

  if (picking) {
    return (
      <CharacterPicker
        candidates={resolution.candidates}
        currentId={actorId}
        onPick={pick}
        onCancel={actorId ? () => setPicking(false) : undefined}
      />
    );
  }

  if (actorId) {
    return <CharacterSheet actorId={actorId} onSwitch={canSwitch ? () => setPicking(true) : undefined} />;
  }

  // No selection and no default → the player owns several PCs but none is assigned.
  if (resolution.candidates.length >= 1) {
    return <CharacterPicker candidates={resolution.candidates} currentId={null} onPick={pick} />;
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-zinc-400">
      <i className="fas fa-user-slash text-3xl" aria-hidden="true" />
      <div>No character to show.</div>
      <div className="text-sm">Ask your GM to give you ownership of a character actor.</div>
    </div>
  );
}
