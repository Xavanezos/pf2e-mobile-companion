/** Guarded scene dispatches. Thin glue over the live `game.scenes`; a rejected
 *  call (e.g. a player lacking token-update permission) surfaces via Foundry's
 *  toast and never throws into React — same contract as `combat/actions.ts`. */

interface LiveGrid {
  getTopLeftPoint?(p: { x: number; y: number }): { x: number; y: number };
}
interface LiveToken {
  update?(data: { x: number; y: number }): Promise<unknown>;
}
interface LiveScene {
  grid?: LiveGrid;
  tokens?: { get(id: string): LiveToken | undefined };
}

function getScene(sceneId: string): LiveScene | undefined {
  return (game as any)?.scenes?.get(sceneId) as LiveScene | undefined;
}

/** Run `fn` with `canvas.grid` temporarily lent the scene's grid.
 *  PF2e's `TokenDocument#measureMovementPath` (token-document/document.ts) runs in
 *  the token-update pipeline and dereferences `canvas.grid.isSquare` — which is
 *  null with `noCanvas`, crashing any token move. The scene's grid is a complete
 *  `SquareGrid` with the same API, so we lend it for the update, then restore.
 *  No-op when the canvas already has a grid (desktop / canvas on). */
async function withCanvasGrid<T>(scene: any, fn: () => Promise<T>): Promise<T> {
  const cv = (globalThis as any).canvas;
  const grid = scene?.grid;
  if (!cv || !grid || cv.grid) return fn();
  const ownDesc = Object.getOwnPropertyDescriptor(cv, "grid");
  Object.defineProperty(cv, "grid", { value: grid, configurable: true, writable: true });
  try {
    return await fn();
  } finally {
    if (ownDesc) Object.defineProperty(cv, "grid", ownDesc);
    else delete cv.grid;
  }
}

async function guard(run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
  } catch (err) {
    console.error("[pf2e-mobile] move failed", err);
    (ui as any)?.notifications?.error?.("Move failed — see console.");
  }
}

/** Move a token to a scene-space pixel position, snapped to the grid. Re-reads
 *  the live token by id, snaps with `scene.grid.getTopLeftPoint` (canvas-free;
 *  falls back to the raw point if unavailable), and dispatches the update —
 *  which Foundry permission-checks server-side (rejection → toast, then the next
 *  `updateToken` re-prep restores the true position). */
export function moveToken(sceneId: string, tokenId: string, x: number, y: number): Promise<void> {
  return guard(async () => {
    const scene = getScene(sceneId);
    const token = scene?.tokens?.get(tokenId);
    if (!token?.update) throw new Error("no such token");
    const snapped = scene?.grid?.getTopLeftPoint?.({ x, y }) ?? { x, y };
    await withCanvasGrid(scene, () => token.update!({ x: snapped.x, y: snapped.y }));
  });
}
