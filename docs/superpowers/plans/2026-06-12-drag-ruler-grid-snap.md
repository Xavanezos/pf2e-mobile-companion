# Drag Ruler + Grid Snap on Token Move — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When dragging your own token on the Map tab, snap it live to grid cells and show the amber drag-ruler (line + "X ft") from its start cell to its current cell.

**Architecture:** Add a pure `snapTopLeft` to the tested `ruler.ts` module (mirrors Foundry's `getTopLeftPoint`). In `BattleMap`, snap the dragged token's origin with it during `onPointerMove`, capture the drag's start position/footprint in `DragState`, and fold the drag line into the existing single ruler render path. The already-snapped origin is passed to `moveToken` so preview == landing spot.

**Tech Stack:** React + TypeScript, Vitest, Tailwind v4, Foundry VTT (PF2e) live documents, no PIXI canvas.

---

### Task 1: Pure `snapTopLeft` helper (TDD)

**Files:**
- Modify: `src/foundry/scene/ruler.ts`
- Test: `tests/ruler.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `tests/ruler.test.ts` (import `snapTopLeft` alongside the existing imports):

```ts
import { snapToCenter, snapTopLeft, measureDistance, type GridSpec } from "../src/foundry/scene/ruler";

const SQUARE: GridSpec = { size: 100, distance: 5, square: true };
const GRIDLESS: GridSpec = { size: 100, distance: 5, square: false };

describe("snapTopLeft", () => {
  it("snaps a point to its grid-cell top-left corner on a square grid", () => {
    expect(snapTopLeft(SQUARE, 140, 260)).toEqual({ x: 100, y: 200 });
    expect(snapTopLeft(SQUARE, 100, 200)).toEqual({ x: 100, y: 200 });
  });

  it("passes the point through unchanged when not a square grid", () => {
    expect(snapTopLeft(GRIDLESS, 140, 260)).toEqual({ x: 140, y: 260 });
  });

  it("is snapToCenter minus half a cell (centers a footprint on the cell)", () => {
    const c = snapToCenter(SQUARE, 140, 260);
    const tl = snapTopLeft(SQUARE, 140, 260);
    expect(tl).toEqual({ x: c.x - SQUARE.size / 2, y: c.y - SQUARE.size / 2 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- ruler`
Expected: FAIL — `snapTopLeft is not a function` / no export.

- [ ] **Step 3: Implement `snapTopLeft`**

Add to `src/foundry/scene/ruler.ts`, directly after `snapToCenter`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- ruler`
Expected: PASS (all snapTopLeft tests green, existing ruler tests still green).

- [ ] **Step 5: Commit**

```bash
git add src/foundry/scene/ruler.ts tests/ruler.test.ts
git commit -m "feat(map): add snapTopLeft grid helper for token-drag snap"
```

---

### Task 2: Snap the dragged token + show the drag ruler

**Files:**
- Modify: `src/app/map/BattleMap.tsx`

This task is wiring in imperative pointer handlers (untested at the unit level,
matching the existing BattleMap pattern). Verify by `npm run build` + manual
play-test. Do all edits, then build, then commit.

- [ ] **Step 1: Import `snapTopLeft`**

In `src/app/map/BattleMap.tsx`, extend the existing `ruler` import:

```ts
import { snapToCenter, snapTopLeft, measureDistance, type GridSpec, type Point } from "../../foundry/scene/ruler";
```

- [ ] **Step 2: Capture start position + footprint in `DragState`**

Replace the `DragState` interface:

```ts
interface DragState {
  pointerId: number;
  id: string;
  offX: number; // scene-space offset from the token origin to the grab point
  offY: number;
  left: number; // latest optimistic token origin (scene px), grid-snapped
  top: number;
  startLeft: number; // token origin at drag start (ruler anchor)
  startTop: number;
  footprintW: number; // grid footprint (for centre = origin + footprint/2)
  footprintH: number;
}
```

- [ ] **Step 3: Widen the `drag` render state to carry the ruler endpoints**

Replace the `drag` state declaration:

```ts
  const [drag, setDrag] = useState<{
    id: string;
    left: number;
    top: number;
    a: Point | null; // drag-ruler start centre (null when no square grid)
    b: Point | null; // drag-ruler current centre
  } | null>(null);
```

- [ ] **Step 4: Populate the new fields when a drag begins**

In `onPointerDown`, inside the `if (tok) {` block, replace the `dragRef.current = ...` and `setDrag(...)` lines with:

```ts
        const sp = screenToScene(lp.x, lp.y, cur0);
        dragRef.current = {
          pointerId: e.pointerId,
          id,
          offX: sp.x - tok.left,
          offY: sp.y - tok.top,
          left: tok.left,
          top: tok.top,
          startLeft: tok.left,
          startTop: tok.top,
          footprintW: tok.footprintW,
          footprintH: tok.footprintH,
        };
        setDrag({ id, left: tok.left, top: tok.top, a: null, b: null });
```

- [ ] **Step 5: Snap the origin + compute ruler endpoints in `onPointerMove`**

In `onPointerMove`, replace the `const d = dragRef.current;` block:

```ts
    const d = dragRef.current;
    if (d && d.pointerId === e.pointerId && view) {
      const lp = localPoint(e);
      const sp = screenToScene(lp.x, lp.y, cur0);
      const grid = gridSpec();
      // snapTopLeft is a no-op off a square grid → token follows the finger.
      const snapped = snapTopLeft(grid, sp.x - d.offX, sp.y - d.offY);
      d.left = snapped.x;
      d.top = snapped.y;
      // Drag ruler: centre-to-centre, square grids only (snapToCenter is a
      // no-op otherwise, which would make a == b and hide the line).
      let a: Point | null = null;
      let b: Point | null = null;
      if (grid.square) {
        a = { x: d.startLeft + d.footprintW / 2, y: d.startTop + d.footprintH / 2 };
        b = { x: d.left + d.footprintW / 2, y: d.top + d.footprintH / 2 };
      }
      setDrag({ id: d.id, left: d.left, top: d.top, a, b });
      return;
    }
```

- [ ] **Step 6: Fold the drag line into the single ruler render path**

Replace the ruler-derivation block (the `rulerMeas` / `rulerLabel` lines near the
end, before `return (`) with a unified `activeRuler`:

```ts
  // One ruler render path: measure-mode line, or the live token-drag line (the
  // two never coexist — ruler-mode suspends token dragging).
  const activeRuler =
    rulerLine ?? (drag?.a && drag?.b ? { a: drag.a, b: drag.b } : null);
  const rulerMeas = activeRuler ? measureDistance(gridSpec(), activeRuler.a, activeRuler.b) : null;
  const rulerLabel = activeRuler && t ? sceneToScreen(activeRuler.b.x, activeRuler.b.y, t) : null;
```

- [ ] **Step 7: Point the SVG + label render at `activeRuler`**

In the JSX, replace every `rulerLine` reference in the SVG block and the label
block with `activeRuler`. Specifically:
- `{rulerLine && (` → `{activeRuler && (`
- `x1={rulerLine.a.x}` → `x1={activeRuler.a.x}` (and `y1`, `x2`, `y2` likewise)
- `cx={rulerLine.a.x} cy={rulerLine.a.y}` → `activeRuler.a.x` / `.a.y`
- `cx={rulerLine.b.x} cy={rulerLine.b.y}` → `activeRuler.b.x` / `.b.y`

The label block already uses `rulerLabel` + `rulerMeas`, which now follow
`activeRuler` — no change there beyond Step 6.

- [ ] **Step 8: Drop the stale optimistic-position reference in the token map**

The token render reads `drag.left/drag.top` — still present, so the
`view.tokens.map` block needs no change. Confirm it still reads:

```ts
              const shown = dragging && drag ? { ...tok, left: drag.left, top: drag.top } : tok;
```

- [ ] **Step 9: Build + typecheck**

Run: `npm run build`
Expected: PASS (no TS errors; `Point`/`snapTopLeft` resolve).

- [ ] **Step 10: Run the full test suite**

Run: `npm test`
Expected: PASS — existing suite green (drag-ruler logic is exercised manually;
the pure snap is covered by Task 1).

- [ ] **Step 11: Commit**

```bash
git add src/app/map/BattleMap.tsx
git commit -m "feat(map): live grid-snap + drag ruler while moving a token"
```

---

## Manual verification (play-test on Ezren)

On a **square-gridded** scene, drag your own token:
- It snaps cell-to-cell as you drag (no smooth sub-cell motion).
- An amber line + "X ft" label trail from the start cell to the current cell,
  with PF2e alternating-diagonal feet (5/10/15 for diagonals).
- On release there is **no jump** — it lands exactly where the preview sat.

On a **gridless** scene, drag your own token:
- It follows the finger smoothly (no snap) and there is no drag line.

Confirm the separate **ruler-mode** tool still measures as before.
