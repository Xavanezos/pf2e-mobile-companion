// Pure: topmost visible token whose AABB contains a world point. Plus a thin live
// wrapper that reads `canvas.tokens.placeables` and converts a screen point to
// world coords via the stage transform.

export interface HitToken {
  id: string;
  left: number; top: number; right: number; bottom: number; // world (scene-px) AABB
  visible: boolean;
}

/** All visible tokens whose box contains `point`, in draw order (topmost LAST).
 *  Lets a caller pick the topmost overall (for a tap) or the topmost that's mine
 *  (to drag my token out from under an overlapping enemy). */
export function pickTokensAt(point: { x: number; y: number }, tokens: HitToken[]): string[] {
  const hits: string[] = [];
  for (const t of tokens) {
    if (!t.visible) continue;
    if (point.x >= t.left && point.x <= t.right && point.y >= t.top && point.y <= t.bottom) {
      hits.push(t.id);
    }
  }
  return hits;
}

/** Topmost visible token whose box contains `point`; null on a miss. */
export function pickTopTokenAt(point: { x: number; y: number }, tokens: HitToken[]): string | null {
  const hits = pickTokensAt(point, tokens);
  return hits.length ? hits[hits.length - 1] : null;
}

/** Live: visible token ids under a screen (client px) point, topmost LAST; []
 *  when the canvas is off. */
export function tokenIdsAtScreenPoint(clientX: number, clientY: number): string[] {
  const cv = (globalThis as any).canvas;
  if (!cv?.ready) return [];
  const P = (globalThis as any).PIXI?.Point;
  const local = cv.stage.toLocal(P ? new P(clientX, clientY) : { x: clientX, y: clientY });
  const tokens: HitToken[] = (cv.tokens?.placeables ?? []).map((t: any) => {
    const b = t.bounds; // PIXI.Rectangle in world coords
    return { id: t.id, left: b.x, top: b.y, right: b.x + b.width, bottom: b.y + b.height, visible: !!t.visible };
  });
  return pickTokensAt({ x: local.x, y: local.y }, tokens);
}

/** Live: topmost token id under a screen point, or null. */
export function tokenIdAtScreenPoint(clientX: number, clientY: number): string | null {
  const ids = tokenIdsAtScreenPoint(clientX, clientY);
  return ids.length ? ids[ids.length - 1] : null;
}

/** Live: a token's CURRENT grid origin (top-left, scene px), read fresh at call
 *  time off the live TokenDocument. A drag must anchor here, NOT to the prepared
 *  `SceneView` snapshot: that snapshot only refreshes on the `updateToken` hook
 *  re-prep and can lag a move behind, which would anchor the grab offset +
 *  drag-ruler to the PREVIOUS cell. Resolved via the paths this module/codebase
 *  already proves live — the placeable list (the hit-test reads it) or the active
 *  scene's token collection (`moveToken`/targeting read it); both share the one
 *  live document. null off-canvas (lite mode) or unknown token → caller falls
 *  back to the view. */
export function liveTokenOrigin(id: string): { left: number; top: number } | null {
  const cv = (globalThis as any).canvas;
  const doc =
    cv?.tokens?.placeables?.find?.((t: any) => t.id === id)?.document ??
    (globalThis as any).game?.scenes?.active?.tokens?.get?.(id);
  if (!doc || typeof doc.x !== "number" || typeof doc.y !== "number") return null;
  return { left: doc.x, top: doc.y };
}
