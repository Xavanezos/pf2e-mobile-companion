// src/foundry/canvas/control.ts
//
// Canvas control actions the Map tab's input layer needs but the native canvas
// never receives (our transparent overlay eats every pointer event): releasing
// the token selection, and operating doors. All no-op safely off-canvas (lite
// mode), so React callers needn't guard.

// CONST.WALL_DOOR_STATES (inlined — this project has no Foundry typings and
// inlines CONST values elsewhere, e.g. scene/types.ts).
const DOOR_CLOSED = 0;
const DOOR_OPEN = 1;
const DOOR_LOCKED = 2;

function liveCanvas(): any {
  return (globalThis as any).canvas ?? null;
}

/** Release any controlled (selected) tokens — mirrors Foundry's left-click on an
 *  empty spot. No-op off-canvas. */
export function releaseControlledTokens(): void {
  liveCanvas()?.tokens?.releaseAll?.();
}

export interface DoorHit {
  x: number;
  y: number; // door-control icon position, world (scene) px
  visible: boolean;
}

/** Pure: index of the nearest visible door control within `threshold` of `point`
 *  (world px), or -1. Door controls sit at the wall midpoint. */
export function nearestDoorIndex(
  point: { x: number; y: number },
  doors: DoorHit[],
  threshold: number,
): number {
  let best = -1;
  let bestDist = threshold;
  for (let i = 0; i < doors.length; i++) {
    const d = doors[i];
    if (!d.visible) continue;
    const dist = Math.hypot(d.x - point.x, d.y - point.y);
    if (dist <= bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

/** Toggle the door whose control is nearest a world point (within ~half a grid
 *  square). CLOSED↔OPEN; a LOCKED door stays shut (with a toast). Returns true
 *  when a door was hit, so the caller knows the tap was consumed (and shouldn't
 *  also release the selection). Guarded — a permission rejection surfaces as
 *  Foundry's own toast rather than throwing into React. */
export function toggleDoorAt(worldX: number, worldY: number): boolean {
  const cv = liveCanvas();
  if (!cv?.ready) return false;
  const controls: any[] = cv.controls?.doors?.children ?? [];
  const doors: DoorHit[] = controls.map((c) => ({ x: c?.x ?? 0, y: c?.y ?? 0, visible: !!c?.visible }));
  const threshold = (cv.dimensions?.size ?? 100) * 0.5;
  const i = nearestDoorIndex({ x: worldX, y: worldY }, doors, threshold);
  if (i < 0) return false;

  const ctrl = controls[i];
  const wallDoc = ctrl?.wall?.document ?? ctrl?.wall ?? null;
  const ds = wallDoc?.ds;
  if (ds == null) return false; // not actually a door control
  if (ds === DOOR_LOCKED) {
    (ui as any)?.notifications?.info?.("That door is locked.");
    return true;
  }
  // `update` is async; a permission rejection rejects the promise (Foundry also
  // shows its own toast), so catch it rather than leaving it unhandled.
  Promise.resolve(wallDoc.update?.({ ds: ds === DOOR_OPEN ? DOOR_CLOSED : DOOR_OPEN })).catch(
    (err: unknown) => console.error("[pf2e-mobile] door toggle failed", err),
  );
  return true;
}
