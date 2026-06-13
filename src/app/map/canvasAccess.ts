export function liveCanvas(): any {
  return (globalThis as any).canvas ?? null;
}
/** Current canvas pan center (world) + scale, or null if the canvas isn't ready. */
export function readPan(): { x: number; y: number; scale: number } | null {
  const cv = liveCanvas();
  if (!cv?.ready) return null;
  return { x: cv.stage.pivot.x, y: cv.stage.pivot.y, scale: cv.stage.scale.x };
}
export function applyPan(p: { x: number; y: number; scale: number }): void {
  liveCanvas()?.pan?.(p);
}
export function screenCenter(): { x: number; y: number } {
  return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
}
/** Screen (client px) → world (scene px) via the stage transform; null if off. */
export function worldAt(clientX: number, clientY: number): { x: number; y: number } | null {
  const cv = liveCanvas();
  if (!cv?.ready) return null;
  const P = (globalThis as any).PIXI?.Point;
  const local = cv.stage.toLocal(P ? new P(clientX, clientY) : { x: clientX, y: clientY });
  return { x: local.x, y: local.y };
}
/** World (scene px) → screen (client px) via the stage transform; null if off. */
export function screenAt(worldX: number, worldY: number): { x: number; y: number } | null {
  const cv = liveCanvas();
  if (!cv?.ready) return null;
  const P = (globalThis as any).PIXI?.Point;
  const g = cv.stage.toGlobal(P ? new P(worldX, worldY) : { x: worldX, y: worldY });
  return { x: g.x, y: g.y };
}
