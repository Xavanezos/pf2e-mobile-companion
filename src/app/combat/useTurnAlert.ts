import { useCallback, useRef } from "react";
import { useFoundryHook } from "../useFoundryHook";

const BUZZ_MS = [120, 60, 120]; // short double-buzz pattern

/** Always-on (mounted in Shell): vibrate the phone once when the active
 *  character's turn begins. Watches `updateCombat` and ref-diffs the current
 *  combatant id, so it buzzes only on the transition INTO your turn — not on
 *  every combat update during it. `navigator.vibrate` is feature-detected
 *  (absent on desktop Chrome / iOS Safari → no-op). No render, no state. */
export function useTurnAlert(actorId: string | null): void {
  const lastCurrentId = useRef<string | null>(null);

  const onCombat = useCallback(() => {
    const current = (game as any)?.combat?.combatant ?? null;
    const currentId: string | null = current?.id ?? null;
    if (currentId === lastCurrentId.current) return; // current combatant unchanged → no buzz
    lastCurrentId.current = currentId;
    if (actorId && current?.actor?.id === actorId) {
      (navigator as any)?.vibrate?.(BUZZ_MS);
    }
  }, [actorId]);

  useFoundryHook("updateCombat", onCombat);
}
