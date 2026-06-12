/** Pure distance math for the battle-map ruler. Canvas-free and unit-tested, the
 *  same way `geometry.ts` is — the live `scene.grid` is reduced to a small `GridSpec`
 *  by the thin glue in `BattleMap`, so this file never touches Foundry globals.
 *
 *  Square grids snap to square centers and count with PF2e's alternating-diagonal
 *  rule (the 1st diagonal is 5 ft, the 2nd 10 ft, repeating — the number a GM sees).
 *  Non-square grids (hex/gridless) fall back to straight-line feet, matching the
 *  grid-render scope where only square grids are first-class. */

export interface GridSpec {
  size: number; // px per grid square
  distance: number; // feet per grid square
  square: boolean; // scene.grid.type === 1 (CONST.GRID_TYPES.SQUARE)
}

export interface Point {
  x: number;
  y: number; // scene (padded-canvas) px
}

export interface Measurement {
  feet: number;
  squares: number;
}

/** Snap a scene-px point to the center of its grid square (square grids only,
 *  aligned to the canvas origin — the same alignment `scene.grid.getTopLeftPoint`
 *  uses for token moves). Non-square grids return the point unchanged. */
export function snapToCenter(grid: GridSpec, x: number, y: number): Point {
  if (!grid.square) return { x, y };
  return {
    x: (Math.floor(x / grid.size) + 0.5) * grid.size,
    y: (Math.floor(y / grid.size) + 0.5) * grid.size,
  };
}

/** Snap a top-left point to its grid-cell corner (square grids only, aligned to
 *  the canvas origin — the same result `scene.grid.getTopLeftPoint` yields for a
 *  token move). Non-square grids return the point unchanged. This is
 *  `snapToCenter` minus half a cell, so a footprint placed here sits centred. */
export function snapTopLeft(grid: GridSpec, x: number, y: number): Point {
  if (!grid.square) return { x, y };
  return {
    x: Math.floor(x / grid.size) * grid.size,
    y: Math.floor(y / grid.size) * grid.size,
  };
}

/** Distance between two scene-px points as `{ feet, squares }`. */
export function measureDistance(grid: GridSpec, a: Point, b: Point): Measurement {
  if (!grid.square) {
    const squares = Math.hypot(b.x - a.x, b.y - a.y) / grid.size;
    return { squares, feet: squares * grid.distance };
  }
  const nx = Math.round(Math.abs(b.x - a.x) / grid.size);
  const ny = Math.round(Math.abs(b.y - a.y) / grid.size);
  const diag = Math.min(nx, ny);
  const straight = Math.max(nx, ny) - diag;
  // Alternating cost: odd diagonals = 1 square (5 ft), even = 2 squares (10 ft).
  const squares = straight + Math.ceil(diag / 2) + 2 * Math.floor(diag / 2);
  return { squares, feet: squares * grid.distance };
}
