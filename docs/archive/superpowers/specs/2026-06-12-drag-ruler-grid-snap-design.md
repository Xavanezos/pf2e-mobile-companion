# Drag ruler + grid snap on token move — design

**Date:** 2026-06-12
**Status:** Approved
**Area:** Map tab (`src/app/map/BattleMap.tsx`, `src/foundry/scene/ruler.ts`)

## Goal

When a player drags one of their own tokens on the Map tab, give live
measurement + grid feedback:

1. **Drag ruler** — show the same amber line + "X ft" label the measure tool
   already uses, drawn from the token's pre-drag cell to its current position.
2. **Grid snap** — on a square-gridded scene, snap the dragged token preview
   live to grid cells so it always sits on the square it will land in (matching
   the server-side snap `moveToken` already performs).

## Current behavior (baseline)

- `BattleMap.onPointerMove` moves the dragged token by setting `d.left/d.top`
  to the raw scene-space pointer position (no snap). The preview follows the
  finger pixel-smooth.
- On drop, `endPointer` calls `moveToken`, which snaps via
  `scene.grid.getTopLeftPoint` server-side. Result: a visible "jump" on release
  and no in-flight distance feedback.
- A ruler already exists as a pure, tested module (`ruler.ts`: `snapToCenter`,
  `measureDistance`, `GridSpec`, `Point`) plus an SVG line + dots + screen-px
  "ft" label rendered in `BattleMap`, driven today only by the separate
  **ruler-mode** tool.

## Behavior

While dragging one of the viewer's own tokens:

- **Square grid** (`view.grid?.type === 1`):
  - Token preview **snaps live** to grid cells (discrete jumps).
  - Drag ruler drawn from the token's **pre-drag center** to its **current
    snapped center**, with a live "X ft" label using PF2e alternating-diagonal
    counting (`measureDistance`).
- **Gridless / hex** (not a square grid): no snap (token follows finger); the
  drag ruler still shows straight-line feet (`measureDistance` already returns
  that for non-square specs).
- On drop the ruler vanishes; `moveToken` dispatch semantics are unchanged.

## Snap consistency

Add a pure helper to `ruler.ts`:

```ts
/** Snap a top-left point to its grid-cell corner (square grids only, aligned to
 *  the canvas origin — the same result scene.grid.getTopLeftPoint yields for a
 *  token move). Non-square grids return the point unchanged. */
export function snapTopLeft(grid: GridSpec, x: number, y: number): Point {
  if (!grid.square) return { x, y };
  return {
    x: Math.floor(x / grid.size) * grid.size,
    y: Math.floor(y / grid.size) * grid.size,
  };
}
```

This is `snapToCenter` minus half a cell, so token center = snapped top-left +
footprint/2 lands on the cell center.

The drag handler snaps `d.left/d.top` with `snapTopLeft` so:
- the **preview** is correct, and
- the already-snapped origin is what we pass to `moveToken` — whose
  `getTopLeftPoint` is idempotent on an already-snapped point — guaranteeing the
  preview and the final landing position are identical (kills the release-jump).

## Render

Reuse the existing SVG line/dots + screen-px label. Ruler-mode and token-drag
never coexist (ruler-mode suspends dragging), so fold both sources into a single
`activeRuler {a, b}` + `activeMeas` with one render path:

- Measure mode: `activeRuler = rulerLine` (unchanged).
- Token drag (square grid): `activeRuler = { a: startCenter, b: currentCenter }`
  where `startCenter = { startLeft + footprintW/2, startTop + footprintH/2 }`
  and `currentCenter = { d.left + footprintW/2, d.top + footprintH/2 }`.

`DragState` (and the `drag` render state) gain `startLeft/startTop` and
`footprintW/footprintH`, captured from the token at drag start.

## Testing

- Unit-test `snapTopLeft` in `tests/ruler.test.ts`:
  - square grid snaps a point to its cell corner,
  - gridless/non-square passes the point through unchanged,
  - the `snapTopLeft == snapToCenter - size/2` identity.
- BattleMap pointer handlers remain untested at the unit level (imperative DOM,
  matching the existing pattern) — all real logic lives in the pure, tested snap.

## Scope guard (YAGNI)

No movement-budget coloring, no path/waypoints, no multi-cell drag trail — just
line + distance + snap.
