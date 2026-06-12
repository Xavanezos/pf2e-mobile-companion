/** Pure pan/zoom transform helpers for the battle map. The stage is rendered
 *  with CSS `transform: translate(panX, panY) scale(zoom)` and `transform-origin:
 *  0 0`, so a scene-space point maps to screen space by `p * zoom + pan`, and the
 *  inverse recovers the scene point under a pointer (used for token drag). */
export interface ViewTransform {
  panX: number;
  panY: number;
  zoom: number;
}

/** Screen (viewport px) → scene (padded-canvas px). */
export function screenToScene(px: number, py: number, t: ViewTransform): { x: number; y: number } {
  return { x: (px - t.panX) / t.zoom, y: (py - t.panY) / t.zoom };
}

/** Scene (padded-canvas px) → screen (viewport px). */
export function sceneToScreen(x: number, y: number, t: ViewTransform): { px: number; py: number } {
  return { px: x * t.zoom + t.panX, py: y * t.zoom + t.panY };
}
