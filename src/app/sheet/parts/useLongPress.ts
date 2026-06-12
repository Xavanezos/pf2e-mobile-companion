import { useRef } from "react";
import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from "react";

/** Pointer handlers that distinguish a long press from a tap. Holding ~500ms
 *  without moving fires `onLongPress`; releasing before that (and without moving)
 *  fires `onTap`. Moving past a few px cancels both — that's a scroll, not a
 *  press. The context menu is suppressed so a held press doesn't pop the native
 *  one. Spread the returned object onto the target element. */
export function useLongPress(onLongPress: () => void, onTap?: () => void, ms = 500) {
  const timer = useRef<number | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const longFired = useRef(false);
  const moved = useRef(false);

  const cancelTimer = () => {
    if (timer.current != null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  return {
    onPointerDown: (e: ReactPointerEvent) => {
      longFired.current = false;
      moved.current = false;
      origin.current = { x: e.clientX, y: e.clientY };
      cancelTimer();
      timer.current = window.setTimeout(() => {
        longFired.current = true;
        onLongPress();
      }, ms);
    },
    onPointerMove: (e: ReactPointerEvent) => {
      if (!origin.current) return;
      const dx = e.clientX - origin.current.x;
      const dy = e.clientY - origin.current.y;
      if (dx * dx + dy * dy > 100) {
        // moved >10px → treat as a scroll and cancel the pending long press
        moved.current = true;
        cancelTimer();
      }
    },
    onPointerUp: () => {
      cancelTimer();
      if (!longFired.current && !moved.current) onTap?.();
      origin.current = null;
    },
    onPointerCancel: () => {
      cancelTimer();
      moved.current = true;
      origin.current = null;
    },
    onContextMenu: (e: ReactMouseEvent) => e.preventDefault(),
  };
}
