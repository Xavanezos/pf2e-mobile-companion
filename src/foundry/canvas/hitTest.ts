// src/foundry/canvas/hitTest.ts
// Pure: topmost visible token whose AABB contains a world point. Plus a thin live
// wrapper that reads `canvas.tokens.placeables` and converts a screen point to
// world coords via the stage transform.

export interface HitToken {
  id: string;
  left: number; top: number; right: number; bottom: number; // world (scene-px) AABB
  visible: boolean;
}

/** Topmost visible token whose box contains `point`; null on a miss. Tokens are
 *  tested in array order; later entries win ties (they draw on top). */
export function pickTopTokenAt(point: { x: number; y: number }, tokens: HitToken[]): string | null {
  let hit: string | null = null;
  for (const t of tokens) {
    if (!t.visible) continue;
    if (point.x >= t.left && point.x <= t.right && point.y >= t.top && point.y <= t.bottom) {
      hit = t.id; // keep scanning so a higher token overrides
    }
  }
  return hit;
}

/** Live: token id under a screen (client px) point, or null. Reads the canvas;
 *  no-op (null) when the canvas is off. ⚠ Confirm `token.bounds` world-space +
 *  `stage.toLocal` mapping in the spike. */
export function tokenIdAtScreenPoint(clientX: number, clientY: number): string | null {
  const cv = (globalThis as any).canvas;
  if (!cv?.ready) return null;
  const P = (globalThis as any).PIXI?.Point;
  const local = cv.stage.toLocal(P ? new P(clientX, clientY) : { x: clientX, y: clientY });
  const tokens: HitToken[] = (cv.tokens?.placeables ?? []).map((t: any) => {
    const b = t.bounds; // PIXI.Rectangle in world coords
    return { id: t.id, left: b.x, top: b.y, right: b.x + b.width, bottom: b.y + b.height, visible: !!t.visible };
  });
  return pickTopTokenAt({ x: local.x, y: local.y }, tokens);
}
