// Pure pan/zoom math for driving Foundry's `canvas.pan({x,y,scale})`. `(x,y)` is
// the world (scene-px) point the view centers on; `scale` is zoom. The canvas
// projects a world point `w` to screen as `(w - pivot) * scale + screenCenter`,
// where `screenCenter` is the window center; these helpers invert that.

export interface CanvasPan { x: number; y: number; scale: number; }

/** New pan center after dragging the view by a screen-space delta. */
export function panForDrag(
  pivotX: number, pivotY: number, scale: number, dxScreen: number, dyScreen: number,
): { x: number; y: number } {
  return { x: pivotX - dxScreen / scale, y: pivotY - dyScreen / scale };
}

/** New pan center that keeps `world` under `screen` after zooming to `newScale`.
 *  `screenCenter` is the window center in screen px. */
export function panForFocalZoom(
  world: { x: number; y: number },
  screen: { x: number; y: number },
  screenCenter: { x: number; y: number },
  newScale: number,
): { x: number; y: number } {
  return {
    x: world.x - (screen.x - screenCenter.x) / newScale,
    y: world.y - (screen.y - screenCenter.y) / newScale,
  };
}

export function clampScale(scale: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, scale));
}
