import type { ReactNode } from "react";
import { useLongPress } from "./useLongPress";

/** A chip rendered as a button that supports both a tap (open details) and a
 *  long press (open the remove popup). `select-none` + suppressed callout keep a
 *  held press from selecting text or popping the iOS magnifier. */
export function EffectChip({ children, onTap, onLongPress }: {
  children: ReactNode;
  onTap?: () => void;
  onLongPress?: () => void;
}) {
  const handlers = useLongPress(onLongPress ?? (() => {}), onTap);
  return (
    <button
      {...handlers}
      className="inline-flex min-h-0 select-none items-center gap-1 rounded-md bg-zinc-800 px-2 py-1 text-xs font-semibold text-zinc-200"
      style={{ touchAction: "manipulation", WebkitTouchCallout: "none" }}
    >
      {children}
    </button>
  );
}
