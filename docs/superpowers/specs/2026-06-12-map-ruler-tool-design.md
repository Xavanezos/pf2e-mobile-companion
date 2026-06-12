# Map Ruler Tool — Design

**Date:** 2026-06-12
**Status:** Approved (pending spec review)
**Context:** Phase 7 battle map ([[phase-7-progress]]). Adds a distance-measuring ruler to the Map tab.

## Goal

Let a player measure distance on the battle map the way a PF2e GM would — tap a ruler
toggle, drag from A to B, and read the distance in feet using PF2e's alternating-diagonal
rule. Single straight segment, grid-snapped, square grids only (matching the existing
grid-render scope).

## Decisions (from brainstorming)

- **Activation:** dedicated **ruler-mode toggle**. While on, the normal map gestures
  (pan, pinch, token-drag, tap-info) are fully suspended and one-finger drag measures.
- **Distance rule:** **match Foundry PF2e** — snap endpoints to grid square centers and
  count with the 5-10-5 alternating-diagonal rule.
- **Path:** **single segment** A→B (no multi-waypoint).

## Architecture

Follows the established Phase 7 pattern: a **pure, tested core** (`foundry/scene/*.ts`)
plus **thin glue** in the React component. No PIXI canvas; `noCanvas` stays on.

### 1. Pure module — `src/foundry/scene/ruler.ts`

Canvas-free, unit-tested. Depends only on `scene.grid` (the same `SquareGrid` already
used by `moveToken`/grid render) and `scene.grid.distance`/`.size`.

```ts
interface Point { x: number; y: number }        // scene (padded-canvas) px
interface Measurement { feet: number; squares: number }

// Snap a scene-px point to the nearest grid square CENTER (square grids).
function snapToCenter(scene, x, y): Point

// PF2e distance between two scene-px points.
function measureDistance(scene, a: Point, b: Point): Measurement
```

**PF2e alternating-diagonal math** (square grids):
- Convert each endpoint to square indices via `scene.grid` (size = px/square).
- `nx = |bx − ax|`, `ny = |by − ay|` in squares.
- `diag = min(nx, ny)`, `straight = max(nx, ny) − diag`.
- `squares = straight + ceil(diag/2) + 2·floor(diag/2)`
  (1st diagonal = 1 square, 2nd = 2, alternating → 5-10-5-10 ft at 5 ft/square).
- `feet = squares × scene.grid.distance` (default 5).

**Fallback:** if `scene.grid.type !== 1` (hex/gridless), return Euclidean feet
(`hypot(dx,dy)/size × distance`) and skip snapping. Matches grid-render: square only is
the first-class path.

### 2. Ruler mode in `src/app/map/BattleMap.tsx`

New state:
- `rulerMode: boolean`
- `rulerLine: { a: Point; b: Point } | null` (scene px, snapped)
- a `rulerRef` mirror for the live pointer handlers (same `tRef`/`dragRef` pattern).

Pointer handling: at the **top** of `onPointerDown/Move/endPointer`, when `rulerMode` is
on, branch *before* the token-drag / pan / pinch logic:
- **down:** `a = b = snapToCenter(scene, screenToScene(lp))`; set `rulerLine`; capture pointer.
- **move:** `b = snapToCenter(...)`; update `rulerLine`.
- **up:** leave the line on screen (so the reading persists); clear the transient press.

Toggling ruler mode **off** clears `rulerLine`. Toggling **on** clears any open info popup.

### 3. UI

- **Toggle button:** bottom-right of the viewport, FontAwesome `fa-ruler`, styled like the
  existing target chip (rounded, semi-opaque). Active state highlighted (e.g. amber).
  Rendered as a **sibling of the viewport** so the viewport's `setPointerCapture` can't
  steal its tap (the deselect-bug lesson from Phase 7).
- **Line overlay:** inside the transformed stage, a `pointer-events-none` SVG (or div)
  draws A→B with a **zoom-aware stroke** (`max(1, k/zoom)` scene-px, like the grid line)
  plus small endpoint dots on the snapped centers.
- **Label:** near `b`, a small pill showing `"{feet} ft"`, counter-scaled or sized in
  scene px so it stays legible at the current zoom.

## Data flow

`scene.grid` (live doc) → `snapToCenter` / `measureDistance` (pure) → `rulerLine` state →
SVG overlay + label. No server writes; the ruler is purely local/visual.

## Testing — `tests/ruler.test.ts`

`measureDistance` (square grid, 5 ft):
- pure straight: 3 squares east → 15 ft.
- pure diagonal: 1 → 5 ft, 2 → 15, 3 → 20, 4 → 30 (alternating rule).
- mixed: e.g. 3 across + 1 up → diag 1 + straight 2 → 3 squares → 15 ft.
- zero distance → 0 ft.
- non-5 grid distance (e.g. 10 ft/square) scales correctly.

`snapToCenter`:
- a point inside a square snaps to that square's center.
- points near edges round to the nearer center.

Non-square grid: `measureDistance` returns Euclidean feet; no snap.

Existing 206 tests stay green; target ~214.

## Out of scope (v1)

- Multi-waypoint paths.
- Hex-accurate counting (Euclidean fallback only).
- Measuring *from a token* automatically / movement-cost highlighting.
- Sharing the ruler to other clients (purely local).
