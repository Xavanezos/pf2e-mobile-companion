# Foundry Canvas on the Map Tab — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the real Foundry PIXI canvas on the Map tab (walls, dynamic lighting, fog of war, vision) with a thin mobile touch layer that preserves the existing tap-to-target UX, while the rest of the app stays as light as today by pausing the canvas off-tab.

**Architecture:** The canvas is enabled at boot (invert the existing `noCanvas` takeover target, gated by a new `mapRenderer` setting). A new `CanvasMap` component mounts only on the Map tab; on mount it views + fits the active scene and resumes the canvas render loop, on unmount it pauses it. A transparent input layer over the canvas drives `canvas.pan()` for pan/zoom, hit-tests taps to a token id → the existing `TokenInfoPopup` → `toggleTarget`, and drags your own token → `moveToken`. The Phase 7 DOM `BattleMap` is retained as a `lite` fallback.

**Tech Stack:** Foundry VTT v14, PF2e v8.2+, React 18, TypeScript, Zustand, Vitest, Tailwind v4 (no preflight). Commands: `npm run typecheck`, `npm run build`, `npm run test`.

**Spec:** `docs/superpowers/specs/2026-06-12-foundry-canvas-map-design.md`

**Conventions (this repo):** TDD the pure pieces only; canvas/gesture/lifecycle glue is verified by `typecheck` + production `build` + a live checklist (canvas is a global singleton — same discipline as Phase 7). Commit per task directly to `main`, message `canvas-map (Task N): …` + the `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` trailer. Tailwind-v4 button gotchas apply (use `bg`/`ring`, `justify-start`).

---

## File structure

**New**
- `src/foundry/canvas/lifecycle.ts` — the only module that touches the live `canvas`: `isCanvasReady`, `resumeCanvas`, `pauseCanvas`, `viewActiveScene`, `fitActiveScene`.
- `src/foundry/canvas/view.ts` — pure pan/zoom math: `panForDrag`, `panForFocalZoom`, `clampScale`, type `CanvasPan`.
- `src/foundry/canvas/hitTest.ts` — pure `pickTopTokenAt` + live wrapper `tokenIdAtScreenPoint`, type `HitToken`.
- `src/app/map/useCanvasLifecycle.ts` — React hook: view/fit/resume on mount, pause on unmount.
- `src/app/map/CanvasMap.tsx` — the canvas-path renderer: transparent input layer + gestures + tap popup + drag + overlays.
- `tests/mapRenderer.test.ts`, `tests/canvasView.test.ts`, `tests/canvasHitTest.test.ts` — pure-core tests.

**Modified**
- `src/foundry/mobile.ts` — add `MapRenderer` type + pure `desiredNoCanvas`.
- `src/foundry/settings.ts` — register the `mapRenderer` client setting + get/set; extend `registerSettings` signature.
- `src/foundry/takeover.ts` — invert the `noCanvas` target by `desiredNoCanvas(getMapRenderer())`; add `reconcileMapRenderer`.
- `src/module.ts` — pass the map-renderer onChange to `registerSettings`.
- `src/app/tabs/MapTab.tsx` — pick `CanvasMap` vs `BattleMap`.
- `src/styles/tailwind.css` — reveal `#board` + make the root transparent on `pf2e-mobile-map-active`.

**Reused untouched:** `targeting.ts`, `ruler.ts`, `TokenInfoPopup.tsx`, `useScene.ts`, `scene/actions.ts` (the `withCanvasGrid` lend **stays** — it is already a no-op when `canvas.grid` exists and the `lite` fallback still needs it), `BattleMap.tsx`/`TokenSprite.tsx` (fallback).

---

## Task 0: On-device spike (gating — throwaway, DO NOT COMMIT)

**Purpose:** Prove the performance premise before building the integration. No code is committed; revert all throwaway edits at the end.

- [ ] **Step 1: Temporarily enable the canvas on your device.** In a scratch branch, edit `src/styles/tailwind.css` to remove `#board` from the hide list (line ~51), and in `src/foundry/takeover.ts` temporarily force `await setNoCanvas(false)` instead of `true`. Run `npm run build`, copy `dist/` per the README dev workflow, and load the world on your target Android phone with a **real, representative scene** (your most complex map).

- [ ] **Step 2: Measure.** With Chrome DevTools remote-debugging the phone, record on the Map view: JS heap + GPU memory, frame pacing while panning, and battery/thermal over ~5 min. Then switch to a non-map tab and confirm (next step) you can drop the cost.

- [ ] **Step 3: Confirm isolation.** In the console, run `canvas.app.ticker.stop()` and confirm CPU/GPU usage drops to ~the no-canvas baseline; `canvas.app.ticker.start()` brings it back. Confirm `canvas.scene` is the active scene, `canvas.tokens.placeables[0].visible` reflects fog, and `canvas.stage.toLocal(new PIXI.Point(x,y))` returns sane world coords near a known token.

- [ ] **Step 4: Decision gate.**
  - **PASS** (memory acceptable on your map, ticker-pause isolates cost, gestures feel viable) → revert throwaway edits, proceed to Task 1.
  - **FAIL** (OOM/crash on your map, or cost can't be isolated) → stop; revisit the spec (fall back to `lite` default, or reconsider option B). Record findings in the spec's Live-API section.

- [ ] **Step 5: Revert.** `git checkout -- .` (or discard the scratch branch). Nothing from this task is committed.

---

## Task 1: `mapRenderer` setting + `desiredNoCanvas` (TDD)

**Files:**
- Modify: `src/foundry/mobile.ts`
- Modify: `src/foundry/settings.ts`
- Test: `tests/mapRenderer.test.ts`

- [ ] **Step 1: Write the failing test.**

```ts
// tests/mapRenderer.test.ts
import { describe, it, expect } from "vitest";
import { desiredNoCanvas } from "../src/foundry/mobile";

describe("desiredNoCanvas", () => {
  it("canvas renderer wants the canvas ON (noCanvas false)", () => {
    expect(desiredNoCanvas("canvas")).toBe(false);
  });
  it("lite renderer wants the canvas OFF (noCanvas true)", () => {
    expect(desiredNoCanvas("lite")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails.**

Run: `npm run test -- mapRenderer`
Expected: FAIL — `desiredNoCanvas` is not exported.

- [ ] **Step 3: Add the type + pure helper to `mobile.ts`.** Append after `detectMobile`:

```ts
export type MapRenderer = "canvas" | "lite";

/** Pure: the `core.noCanvas` value a given Map renderer needs. The canvas map
 *  needs the canvas ON (noCanvas false); the lite DOM map needs it OFF (true). */
export function desiredNoCanvas(renderer: MapRenderer): boolean {
  return renderer === "lite";
}
```

- [ ] **Step 4: Run test to verify it passes.**

Run: `npm run test -- mapRenderer`
Expected: PASS (2 tests).

- [ ] **Step 5: Register the `mapRenderer` setting in `settings.ts`.** Change the import and `registerSettings` to add a second callback + the new setting + helpers.

Replace the import line:
```ts
import { detectMobile, desiredNoCanvas, type UiMode, type MapRenderer } from "./mobile";
```

Change the `registerSettings` signature and body to accept and wire `onMapRendererChange`:
```ts
export function registerSettings(
  onUiModeChange: () => void,
  onMapRendererChange: () => void,
): void {
  (game as any).settings.register(MODULE_ID, "uiMode", {
    name: "Mobile UI mode",
    hint: "Automatic uses your device and screen size. 'Always on' forces the mobile UI (handy for testing on desktop). 'Always off' keeps Foundry's normal interface.",
    scope: "client",
    config: true,
    type: String,
    choices: { auto: "Automatic", on: "Always on", off: "Always off" },
    default: "auto",
    onChange: () => onUiModeChange(),
  });

  (game as any).settings.register(MODULE_ID, "mapRenderer", {
    name: "Battle map renderer",
    hint: "Canvas mirrors Foundry's real map — walls, dynamic lighting, fog of war — on the Map tab only (paused elsewhere). Lite is a faster image-and-tokens map for low-power devices.",
    scope: "client",
    config: true,
    type: String,
    choices: { canvas: "Foundry canvas (full)", lite: "Lite (fast)" },
    default: "canvas",
    onChange: () => onMapRendererChange(),
  });

  // Remembers the user's canvas preference before mobile mode changed it,
  // so exiting mobile mode restores it.
  (game as any).settings.register(MODULE_ID, "priorNoCanvas", {
    scope: "client",
    config: false,
    type: Boolean,
    default: false,
  });
}
```

Add helpers after `setUiMode`:
```ts
export function getMapRenderer(): MapRenderer {
  return ((game as any).settings.get(MODULE_ID, "mapRenderer") as MapRenderer) ?? "canvas";
}
export async function setMapRenderer(value: MapRenderer): Promise<void> {
  await (game as any).settings.set(MODULE_ID, "mapRenderer", value);
}
```

Re-export the pure helper so other modules import it from `settings`:
```ts
export { desiredNoCanvas } from "./mobile";
export type { MapRenderer } from "./mobile";
```

- [ ] **Step 6: Typecheck.**

Run: `npm run typecheck`
Expected: a type error in `src/module.ts` — `registerSettings` now needs two args. Leave it; Task 2 fixes the caller. (If you prefer a green gate here, do Task 2 Step 4 now.) Confirm there are **no other** type errors.

- [ ] **Step 7: Commit.**

```bash
git add src/foundry/mobile.ts src/foundry/settings.ts tests/mapRenderer.test.ts
git commit -m "canvas-map (Task 1): add mapRenderer setting + desiredNoCanvas" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Invert the takeover `noCanvas` target + runtime reconcile

**Files:**
- Modify: `src/foundry/takeover.ts`
- Modify: `src/module.ts`

- [ ] **Step 1: Rewrite the canvas-target logic in `takeover.ts`.** Change the import to pull in the setting + pure helper:

```ts
import {
  getNoCanvas, setNoCanvas, getPriorNoCanvas, setPriorNoCanvas,
  getMapRenderer, desiredNoCanvas,
} from "./settings";
```

Replace the body of `applyTakeover` (the `if (!getNoCanvas()) { … }` block) with a target-driven flip:

```ts
export async function applyTakeover(
  mountFn: (container: HTMLElement) => void | Promise<void>,
): Promise<void> {
  // The canvas requirement depends on the chosen Map renderer: canvas mode wants
  // it ON (noCanvas false), lite mode OFF (true). Flip + reload once if needed.
  const want = desiredNoCanvas(getMapRenderer());
  if (getNoCanvas() !== want) {
    if (sessionStorage.getItem(RELOAD_SENTINEL)) {
      console.error(`${MODULE_ID} | noCanvas did not settle; aborting reload to avoid a loop`);
      return;
    }
    sessionStorage.setItem(RELOAD_SENTINEL, "1");
    await setPriorNoCanvas(getNoCanvas()); // save the user's real prior value (first entry only)
    await setNoCanvas(want);
    location.reload();
    return;
  }
  sessionStorage.removeItem(RELOAD_SENTINEL);

  document.body.classList.add(BODY_CLASS);

  document.getElementById(ROOT_ID)?.remove();
  const container = document.createElement("div");
  container.id = ROOT_ID;
  document.body.appendChild(container);
  await mountFn(container);
}
```

- [ ] **Step 2: Add `reconcileMapRenderer` to `takeover.ts`** (runtime setting change). Append:

```ts
/** Re-evaluate the canvas on/off requirement when the map-renderer setting
 *  changes at runtime (only while the mobile UI is up). Flips `core.noCanvas`
 *  and reloads so Foundry (re)initializes — or skips — the canvas. Deliberately
 *  does NOT touch `priorNoCanvas`: the user's desktop preference stays as first
 *  saved by `applyTakeover`. */
export async function reconcileMapRenderer(): Promise<void> {
  if (!isTakeoverActive()) return;
  const want = desiredNoCanvas(getMapRenderer());
  if (getNoCanvas() !== want) {
    await setNoCanvas(want);
    location.reload();
  }
}
```

- [ ] **Step 3: Wire the callback in `module.ts`.** Update the import and the `registerSettings` call:

```ts
import { applyTakeover, removeTakeover, isTakeoverActive, reconcileMapRenderer } from "./foundry/takeover";
```

```ts
Hooks.once("init", () => {
  console.log(`${MODULE_ID} | init`);
  registerSettings(
    () => { void onUiModeChange(); },
    () => { void reconcileMapRenderer(); },
  );
});
```

- [ ] **Step 4: Typecheck + build.**

Run: `npm run typecheck && npm run build`
Expected: both PASS (the Task 1 caller error is now resolved).

- [ ] **Step 5: Commit.**

```bash
git add src/foundry/takeover.ts src/module.ts
git commit -m "canvas-map (Task 2): target noCanvas by mapRenderer + runtime reconcile" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Canvas lifecycle module + CSS reveal

**Files:**
- Create: `src/foundry/canvas/lifecycle.ts`
- Modify: `src/styles/tailwind.css`

- [ ] **Step 1: Create `lifecycle.ts`.**

```ts
// src/foundry/canvas/lifecycle.ts
//
// The ONLY module that touches the live `canvas`. Drives the Foundry PIXI canvas
// for the Map tab: show/hide + pause/resume its render loop, view the active
// scene, fit it to the viewport. Every function no-ops safely when the canvas is
// disabled (lite mode / `noCanvas`), so React callers needn't guard.

const MAP_CLASS = "pf2e-mobile-map-active";

function liveCanvas(): any {
  return (globalThis as any).canvas ?? null;
}

/** True when Foundry's canvas is initialized and drawable (canvas mode). */
export function isCanvasReady(): boolean {
  return !!liveCanvas()?.ready;
}

/** Reveal `#board` and resume its render loop (Map tab entered). */
export function resumeCanvas(): void {
  const cv = liveCanvas();
  if (!cv?.ready) return;
  document.body.classList.add(MAP_CLASS);
  // `canvas.app.ticker` is PIXI's render loop. If a future Foundry renames it,
  // fall back to `cv.app?.start?.()` (confirm in the spike).
  cv.app?.ticker?.start?.();
}

/** Hide `#board` and stop its render loop (Map tab left). Safe to call anytime. */
export function pauseCanvas(): void {
  const cv = liveCanvas();
  document.body.classList.remove(MAP_CLASS);
  cv?.app?.ticker?.stop?.();
}

/** Ensure the canvas shows the active scene (the one the rest of the app
 *  mirrors). No-op if already viewing it or the canvas is off. */
export async function viewActiveScene(): Promise<void> {
  const cv = liveCanvas();
  const active = (game as any)?.scenes?.active;
  if (!cv?.ready || !active) return;
  if (cv.scene?.id !== active.id) {
    try {
      await active.view();
    } catch (err) {
      console.error("[pf2e-mobile] scene view failed", err);
    }
  }
}

/** Center + zoom the canvas so the whole padded scene fits the window. */
export function fitActiveScene(): void {
  const cv = liveCanvas();
  const dims = cv?.dimensions;
  if (!cv?.ready || !dims) return;
  const scale = Math.min(window.innerWidth / dims.width, window.innerHeight / dims.height);
  cv.pan?.({ x: dims.width / 2, y: dims.height / 2, scale });
}
```

- [ ] **Step 2: Add the CSS reveal to `tailwind.css`.** Insert after the stock-chrome hide block (after line ~63, the `body.pf2e-mobile-active { overflow: hidden }` rule):

```css
/* Map tab: reveal the Foundry canvas only while the Map tab is active. The hide
   rule above is !important, so out-specify it with BOTH body classes. The app
   root (z-index 100000, opaque) goes transparent so the board — which fills the
   window behind it — shows through the transparent map area; opaque chrome
   (header, tab bar, macro bar) still paints above it. */
body.pf2e-mobile-active.pf2e-mobile-map-active #board {
  display: block !important;
}
body.pf2e-mobile-active.pf2e-mobile-map-active #pf2e-mobile-companion-root {
  background: transparent !important;
}
```

- [ ] **Step 3: Typecheck + build.**

Run: `npm run typecheck && npm run build`
Expected: both PASS. (No live check yet — nothing mounts the lifecycle until Task 5.)

- [ ] **Step 4: Commit.**

```bash
git add src/foundry/canvas/lifecycle.ts src/styles/tailwind.css
git commit -m "canvas-map (Task 3): canvas lifecycle (pause/resume/view/fit) + board reveal CSS" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Pure view math + hit-test (TDD)

**Files:**
- Create: `src/foundry/canvas/view.ts`
- Create: `src/foundry/canvas/hitTest.ts`
- Test: `tests/canvasView.test.ts`, `tests/canvasHitTest.test.ts`

- [ ] **Step 1: Write the failing view-math test.**

```ts
// tests/canvasView.test.ts
import { describe, it, expect } from "vitest";
import { panForDrag, panForFocalZoom, clampScale } from "../src/foundry/canvas/view";

describe("clampScale", () => {
  it("clamps to [min,max]", () => {
    expect(clampScale(10, 0.05, 4)).toBe(4);
    expect(clampScale(0.001, 0.05, 4)).toBe(0.05);
    expect(clampScale(1, 0.05, 4)).toBe(1);
  });
});

describe("panForDrag", () => {
  it("shifts the world center opposite the screen drag, scaled by zoom", () => {
    // drag 100px right at 2x zoom → center moves 50 world units left
    expect(panForDrag(1000, 500, 2, 100, 0)).toEqual({ x: 950, y: 500 });
  });
});

describe("panForFocalZoom", () => {
  it("keeps the focal world point under the focal screen point", () => {
    // world point under the focal stays put: pivot = world - (screen-center)/scale
    const world = { x: 600, y: 400 };
    const screen = { x: 800, y: 600 }; // focal in screen px
    const center = { x: 500, y: 500 }; // window/2
    const pivot = panForFocalZoom(world, screen, center, 2);
    expect(pivot).toEqual({ x: 600 - (800 - 500) / 2, y: 400 - (600 - 500) / 2 });
    // and re-projecting world through (pivot,scale) lands back on screen:
    const projX = (world.x - pivot.x) * 2 + center.x;
    const projY = (world.y - pivot.y) * 2 + center.y;
    expect({ x: projX, y: projY }).toEqual(screen);
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (`view.ts` missing).

Run: `npm run test -- canvasView`
Expected: FAIL — cannot find module `../src/foundry/canvas/view`.

- [ ] **Step 3: Implement `view.ts`.**

```ts
// src/foundry/canvas/view.ts
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
```

- [ ] **Step 4: Run it — expect PASS.**

Run: `npm run test -- canvasView`
Expected: PASS (3 describes).

- [ ] **Step 5: Write the failing hit-test test.**

```ts
// tests/canvasHitTest.test.ts
import { describe, it, expect } from "vitest";
import { pickTopTokenAt, type HitToken } from "../src/foundry/canvas/hitTest";

const tok = (id: string, x: number, y: number, visible = true): HitToken =>
  ({ id, left: x, top: y, right: x + 100, bottom: y + 100, visible });

describe("pickTopTokenAt", () => {
  it("returns the token whose box contains the point", () => {
    expect(pickTopTokenAt({ x: 150, y: 150 }, [tok("a", 100, 100)])).toBe("a");
  });
  it("returns null on a miss", () => {
    expect(pickTopTokenAt({ x: 5, y: 5 }, [tok("a", 100, 100)])).toBeNull();
  });
  it("skips non-visible tokens (fog/vision)", () => {
    expect(pickTopTokenAt({ x: 150, y: 150 }, [tok("a", 100, 100, false)])).toBeNull();
  });
  it("topmost (later in array) wins overlaps", () => {
    expect(pickTopTokenAt({ x: 150, y: 150 }, [tok("under", 100, 100), tok("over", 120, 120)])).toBe("over");
  });
});
```

- [ ] **Step 6: Run it — expect FAIL** (`hitTest.ts` missing).

Run: `npm run test -- canvasHitTest`
Expected: FAIL — cannot find module.

- [ ] **Step 7: Implement `hitTest.ts`** (pure core + live wrapper).

```ts
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
```

- [ ] **Step 8: Run it — expect PASS.**

Run: `npm run test -- canvasHitTest`
Expected: PASS (4 tests).

- [ ] **Step 9: Full test + typecheck.**

Run: `npm run test && npm run typecheck`
Expected: all green.

- [ ] **Step 10: Commit.**

```bash
git add src/foundry/canvas/view.ts src/foundry/canvas/hitTest.ts tests/canvasView.test.ts tests/canvasHitTest.test.ts
git commit -m "canvas-map (Task 4): pure pan/zoom math + token hit-test" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: CanvasMap (render + pan/zoom + tap→popup→target) + MapTab pick — LIVE CHECKPOINT

**Files:**
- Create: `src/app/map/useCanvasLifecycle.ts`
- Create: `src/app/map/CanvasMap.tsx`
- Modify: `src/app/tabs/MapTab.tsx`

- [ ] **Step 1: Create the lifecycle hook.**

```ts
// src/app/map/useCanvasLifecycle.ts
import { useEffect } from "react";
import { resumeCanvas, pauseCanvas, viewActiveScene, fitActiveScene } from "../../foundry/canvas/lifecycle";

/** Map-tab canvas lifecycle. TabContent mounts/unmounts MapTab on tab change, so
 *  this runs once per visit: on mount view + fit the active scene and resume the
 *  render loop; on unmount pause it (and hide the board). */
export function useCanvasLifecycle(): void {
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await viewActiveScene();
      if (cancelled) return;
      resumeCanvas();
      fitActiveScene();
    })();
    return () => {
      cancelled = true;
      pauseCanvas();
    };
  }, []);
}
```

- [ ] **Step 2: Create `CanvasMap.tsx`** (pan/zoom + tap→popup→target + lifecycle).

```tsx
// src/app/map/CanvasMap.tsx
import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { useAppStore } from "../store";
import { useScene } from "./useScene";
import { TokenInfoPopup } from "./TokenInfoPopup";
import { useCanvasLifecycle } from "./useCanvasLifecycle";
import { panForDrag, panForFocalZoom, clampScale } from "../../foundry/canvas/view";
import { tokenIdAtScreenPoint } from "../../foundry/canvas/hitTest";

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 4;
const TAP_SLOP = 6;

function liveCanvas(): any {
  return (globalThis as any).canvas ?? null;
}
/** Current canvas pan center (world) + scale, or null if the canvas isn't ready. */
function readPan(): { x: number; y: number; scale: number } | null {
  const cv = liveCanvas();
  if (!cv?.ready) return null;
  return { x: cv.stage.pivot.x, y: cv.stage.pivot.y, scale: cv.stage.scale.x };
}
function applyPan(p: { x: number; y: number; scale: number }): void {
  liveCanvas()?.pan?.(p);
}
function screenCenter(): { x: number; y: number } {
  return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
}
/** Screen (client px) → world (scene px) via the stage transform; null if off. */
function worldAt(clientX: number, clientY: number): { x: number; y: number } | null {
  const cv = liveCanvas();
  if (!cv?.ready) return null;
  const P = (globalThis as any).PIXI?.Point;
  const local = cv.stage.toLocal(P ? new P(clientX, clientY) : { x: clientX, y: clientY });
  return { x: local.x, y: local.y };
}

interface PressState {
  pointerId: number;
  tokenId: string | null;
  x: number; y: number; // press origin (client px)
  moved: boolean;
}

/** The Map tab's canvas renderer: a transparent input layer over Foundry's
 *  `#board`. Gestures drive `canvas.pan`; a tap opens the token info popup
 *  (→ targeting). The canvas itself draws the scene, walls, lighting, fog, and
 *  tokens natively. `useScene` supplies the popup's per-token display data. */
export function CanvasMap() {
  useCanvasLifecycle();
  const actorId = useAppStore((s) => s.actorId);
  const view = useScene(actorId);

  const viewportRef = useRef<HTMLDivElement>(null);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const anchor = useRef<{ x: number; y: number; dist: number } | null>(null);
  const pressRef = useRef<PressState | null>(null);
  const [infoId, setInfoId] = useState<string | null>(null);

  const localPoint = (e: ReactPointerEvent) => {
    const r = viewportRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const gestureState = () => {
    const pts = [...pointers.current.values()];
    if (pts.length < 2) return { x: pts[0]?.x ?? 0, y: pts[0]?.y ?? 0, dist: 0 };
    const [a, b] = pts;
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, dist: Math.hypot(a.x - b.x, a.y - b.y) };
  };
  // Gesture midpoint (viewport-local) → window/client coords for focal-zoom math.
  const toClient = (lx: number, ly: number) => {
    const r = viewportRef.current!.getBoundingClientRect();
    return { x: lx + r.left, y: ly + r.top };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const lp = localPoint(e);
    pressRef.current = {
      pointerId: e.pointerId,
      tokenId: tokenIdAtScreenPoint(e.clientX, e.clientY),
      x: e.clientX, y: e.clientY, moved: false,
    };
    pointers.current.set(e.pointerId, lp);
    viewportRef.current?.setPointerCapture(e.pointerId);
    anchor.current = gestureState();
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const pan = readPan();
    if (!pan) return;
    const pr = pressRef.current;
    if (pr && pr.pointerId === e.pointerId && !pr.moved) {
      if (Math.hypot(e.clientX - pr.x, e.clientY - pr.y) > TAP_SLOP) pr.moved = true;
    }
    if (!pointers.current.has(e.pointerId) || !anchor.current) return;
    pointers.current.set(e.pointerId, localPoint(e));
    const prev = anchor.current;
    const cur = gestureState();
    if (pointers.current.size >= 2 && prev.dist > 0) {
      const newScale = clampScale(pan.scale * (cur.dist / prev.dist), MIN_ZOOM, MAX_ZOOM);
      const focal = toClient(cur.x, cur.y); // gesture midpoint in window coords
      const world = worldAt(focal.x, focal.y) ?? { x: pan.x, y: pan.y };
      const center = panForFocalZoom(world, focal, screenCenter(), newScale);
      applyPan({ x: center.x, y: center.y, scale: newScale });
    } else {
      const center = panForDrag(pan.x, pan.y, pan.scale, cur.x - prev.x, cur.y - prev.y);
      applyPan({ x: center.x, y: center.y, scale: pan.scale });
    }
    anchor.current = cur;
  };

  const endPointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    const pr = pressRef.current;
    const isTap = !!pr && pr.pointerId === e.pointerId && !pr.moved && !!pr.tokenId;
    if (isTap && pr?.tokenId) setInfoId(pr.tokenId);
    pointers.current.delete(e.pointerId);
    anchor.current = pointers.current.size ? gestureState() : null;
    if (pr?.pointerId === e.pointerId) pressRef.current = null;
  };

  const onWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    const pan = readPan();
    if (!pan) return;
    const newScale = clampScale(pan.scale * (e.deltaY < 0 ? 1.1 : 1 / 1.1), MIN_ZOOM, MAX_ZOOM);
    const world = worldAt(e.clientX, e.clientY) ?? { x: pan.x, y: pan.y };
    const center = panForFocalZoom(world, { x: e.clientX, y: e.clientY }, screenCenter(), newScale);
    applyPan({ x: center.x, y: center.y, scale: newScale });
  };

  const infoToken = infoId && view ? view.tokens.find((tk) => tk.id === infoId) ?? null : null;

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Transparent input layer over #board: captures all touches (so Foundry's
          native canvas interaction never competes) and drives canvas.pan. */}
      <div
        ref={viewportRef}
        className="absolute inset-0 touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onWheel={onWheel}
      />
      {infoToken && <TokenInfoPopup token={infoToken} onClose={() => setInfoId(null)} />}
    </div>
  );
}
```

- [ ] **Step 3: Wire renderer choice in `MapTab.tsx`.** Replace the whole file:

```tsx
import { useAppStore } from "../store";
import { useHotbar } from "../macros/useHotbar";
import { MacroBar } from "../macros/MacroBar";
import { BattleMap } from "../map/BattleMap";
import { CanvasMap } from "../map/CanvasMap";
import { executeMacro } from "../../foundry/macros/hotbar";
import { getMapRenderer } from "../../foundry/settings";
import { isCanvasReady } from "../../foundry/canvas/lifecycle";

/** The Map tab: the battle map fills the `flex-1` area; the macro bar (Phase 4.1)
 *  stays pinned at the bottom. Uses the real Foundry canvas when the renderer
 *  setting is `canvas` and the canvas initialized; otherwise the lite DOM map. */
export function MapTab() {
  const actorId = useAppStore((s) => s.actorId);
  const macros = useHotbar();
  const useCanvas = getMapRenderer() === "canvas" && isCanvasReady();
  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-hidden">
        {useCanvas ? <CanvasMap /> : <BattleMap />}
      </div>
      {macros && <MacroBar macros={macros} onRun={(id) => void executeMacro(id, actorId)} />}
    </div>
  );
}
```

- [ ] **Step 4: Typecheck + build.**

Run: `npm run typecheck && npm run build`
Expected: both PASS.

- [ ] **Step 5: LIVE CHECKPOINT (canvas mode, on device or width-emulated Chrome).** Build, deploy, log in as a **player** with an active scene that has walls + at least one light + an enemy behind a wall.
  - The Map tab shows the **real Foundry map**: background, dynamic lighting, and **fog of war hides the enemy behind the wall** (the core fidelity win).
  - One-finger **pan** and two-finger **pinch-zoom** move the canvas and feel right; wheel zooms (desktop).
  - **Tap a visible token** → the info popup opens; **Target** sets a reticle the GM sees; **Untarget** clears it.
  - Switch to the **Sheet** tab → the board hides and DevTools shows CPU/GPU drop to ~baseline; return to **Map** → instant, scene re-fit.
  - If `worldAt`/tap is off by a constant factor, suspect devicePixelRatio in `stage.toLocal` — note it and adjust the wrapper (see hitTest ⚠).

- [ ] **Step 6: Commit.**

```bash
git add src/app/map/useCanvasLifecycle.ts src/app/map/CanvasMap.tsx src/app/tabs/MapTab.tsx
git commit -m "canvas-map (Task 5): CanvasMap render + pan/zoom + tap-target; MapTab picks renderer" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Drag-your-own-token + canvas-off audit — LIVE CHECKPOINT

**Files:**
- Modify: `src/app/map/CanvasMap.tsx`

- [ ] **Step 1: Add drag state + the move action import.** At the top of `CanvasMap.tsx`, add to the imports:

```tsx
import { moveToken } from "../../foundry/scene/actions";
```

Add a drag ref type + ref next to the existing refs (after `pressRef`):

```tsx
interface DragState {
  pointerId: number;
  id: string;
  offX: number; offY: number; // world offset from token origin to the grab point
}
```

```tsx
  const dragRef = useRef<DragState | null>(null);
```

- [ ] **Step 2: Start a drag on press if the token is mine.** In `onPointerDown`, after `pressRef.current = { … }` and before `pointers.current.set(...)`, insert:

```tsx
    // Start a token drag if the press landed on one of MY tokens (single pointer).
    const tokenId = pressRef.current.tokenId;
    const tok = tokenId && view ? view.tokens.find((t) => t.id === tokenId) : null;
    if (tok?.isMine && pointers.current.size === 0) {
      const w = worldAt(e.clientX, e.clientY);
      if (w) {
        dragRef.current = { pointerId: e.pointerId, id: tok.id, offX: w.x - tok.left, offY: w.y - tok.top };
        viewportRef.current?.setPointerCapture(e.pointerId);
        return; // a drag suppresses pan/pinch for this pointer
      }
    }
```

- [ ] **Step 3: Suppress pan while dragging.** At the very top of `onPointerMove`, after `const pan = readPan(); if (!pan) return;`, insert:

```tsx
    const d = dragRef.current;
    if (d && d.pointerId === e.pointerId) {
      const pr2 = pressRef.current;
      if (pr2 && !pr2.moved && Math.hypot(e.clientX - pr2.x, e.clientY - pr2.y) > TAP_SLOP) pr2.moved = true;
      return; // no live preview in v1; the canvas updates when the move round-trips
    }
```

- [ ] **Step 4: Commit the move on release.** At the top of `endPointer`, before the `const pr = pressRef.current;` line, insert:

```tsx
    const d = dragRef.current;
    if (d && d.pointerId === e.pointerId) {
      const moved = pressRef.current?.moved;
      if (moved && view) {
        const w = worldAt(e.clientX, e.clientY);
        if (w) void moveToken(view.id, d.id, w.x - d.offX, w.y - d.offY);
      }
      dragRef.current = null;
      if (pressRef.current?.pointerId === e.pointerId) pressRef.current = null;
      pointers.current.delete(e.pointerId);
      return; // a real drag is not a tap
    }
```

- [ ] **Step 5: Canvas-off audit.** Grep for raw `canvas` usage that assumed it was absent:

Run: `git grep -n "canvas" -- src` and eyeball the hits.
Confirm the only canvas touch-points are the new `src/foundry/canvas/*` + `CanvasMap.tsx`, plus the **intentional** `withCanvasGrid` lend in `src/foundry/scene/actions.ts`. **Leave `withCanvasGrid` as-is** — it already no-ops when `canvas.grid` exists (canvas mode) and is still required by the `lite` fallback (canvas off). Add a one-line comment there if not already clear:

```ts
// NB: in canvas mode `cv.grid` exists so this is a no-op; the lend only fires in
// lite/no-canvas mode, where PF2e's measureMovementPath needs a grid.
```

- [ ] **Step 6: Typecheck + build.**

Run: `npm run typecheck && npm run build`
Expected: both PASS.

- [ ] **Step 7: LIVE CHECKPOINT.** As a player on the Map tab: drag **your own** token → on release it snaps to the grid cell and moves on the GM's canvas within ~1s; a rejected move reverts. A non-owned token is **tap-only** (info popup, no drag). Pan still works when the press starts on empty space.

- [ ] **Step 8: Commit.**

```bash
git add src/app/map/CanvasMap.tsx src/foundry/scene/actions.ts
git commit -m "canvas-map (Task 6): drag-own-token via moveToken; confirm withCanvasGrid stays for lite" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Ruler overlay + clear-targets button — FINAL LIVE CHECKLIST

**Files:**
- Modify: `src/app/map/CanvasMap.tsx`

- [ ] **Step 1: Add imports + a world→screen helper + a pan-sync tick.** Add to imports:

```tsx
import { clearTargets } from "../../foundry/scene/targeting";
import { snapToCenter, measureDistance, type GridSpec, type Point } from "../../foundry/scene/ruler";
import { useFoundryHook } from "../useFoundryHook";
```

Add a world→screen helper beside `worldAt`:

```tsx
/** World (scene px) → screen (client px) via the stage transform; null if off. */
function screenAt(worldX: number, worldY: number): { x: number; y: number } | null {
  const cv = liveCanvas();
  if (!cv?.ready) return null;
  const P = (globalThis as any).PIXI?.Point;
  const g = cv.stage.toGlobal(P ? new P(worldX, worldY) : { x: worldX, y: worldY });
  return { x: g.x, y: g.y };
}
```

- [ ] **Step 2: Add ruler + target state + a redraw tick.** Inside `CanvasMap`, after `const [infoId, setInfoId] = useState<string | null>(null);`:

```tsx
  const [rulerMode, setRulerMode] = useState(false);
  const rulerModeRef = useRef(false);
  const [rulerLine, setRulerLine] = useState<{ a: Point; b: Point } | null>(null);
  const rulerRef = useRef<{ pointerId: number; a: Point; b: Point } | null>(null);
  // Bump on canvas pan so the screen-space ruler overlay re-projects with the view.
  const [, setPanTick] = useState(0);
  useFoundryHook("canvasPan", () => setPanTick((n) => n + 1));

  const gridSpec = (): GridSpec => {
    const cv = liveCanvas();
    const grid = cv?.scene?.grid;
    return { size: grid?.size ?? 100, distance: grid?.distance ?? 5, square: (grid?.type ?? 1) === 1 };
  };
  const toggleRuler = () => {
    const next = !rulerModeRef.current;
    rulerModeRef.current = next;
    setRulerMode(next);
    rulerRef.current = null;
    setRulerLine(null);
    if (next) setInfoId(null);
  };
```

- [ ] **Step 3: Branch the pointer handlers for ruler mode.** At the very top of `onPointerDown` (before the `pressRef.current = …` line), insert:

```tsx
    if (rulerModeRef.current) {
      const w = worldAt(e.clientX, e.clientY);
      if (w) {
        const p = snapToCenter(gridSpec(), w.x, w.y);
        rulerRef.current = { pointerId: e.pointerId, a: p, b: p };
        setRulerLine({ a: p, b: p });
        viewportRef.current?.setPointerCapture(e.pointerId);
      }
      return;
    }
```

At the top of `onPointerMove`, after `if (!pan) return;` and before the drag block, insert:

```tsx
    const r = rulerRef.current;
    if (r && r.pointerId === e.pointerId) {
      const w = worldAt(e.clientX, e.clientY);
      if (w) { r.b = snapToCenter(gridSpec(), w.x, w.y); setRulerLine({ a: r.a, b: r.b }); }
      return;
    }
```

At the top of `endPointer`, before the drag block, insert:

```tsx
    if (rulerRef.current && rulerRef.current.pointerId === e.pointerId) {
      rulerRef.current = null; // leave the measured line on screen
      return;
    }
```

- [ ] **Step 4: Render the overlays.** Replace the component's `return ( … )` JSX with the version that adds the ruler SVG, distance label, ruler toggle, and clear-targets button (all screen-space siblings, re-projected via `screenAt`):

```tsx
  const targetCount = view ? view.tokens.filter((tk) => tk.targeted).length : 0;
  const aScreen = rulerLine ? screenAt(rulerLine.a.x, rulerLine.a.y) : null;
  const bScreen = rulerLine ? screenAt(rulerLine.b.x, rulerLine.b.y) : null;
  const rulerMeas = rulerLine ? measureDistance(gridSpec(), rulerLine.a, rulerLine.b) : null;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        ref={viewportRef}
        className="absolute inset-0 touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onWheel={onWheel}
      />
      {aScreen && bScreen && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
          <line x1={aScreen.x} y1={aScreen.y} x2={bScreen.x} y2={bScreen.y} stroke="#fbbf24" strokeWidth={3} strokeLinecap="round" />
          <circle cx={aScreen.x} cy={aScreen.y} r={5} fill="#fbbf24" />
          <circle cx={bScreen.x} cy={bScreen.y} r={5} fill="#fbbf24" />
        </svg>
      )}
      {bScreen && rulerMeas && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-[140%] rounded bg-amber-500 px-2 py-0.5 text-xs font-bold text-black shadow"
          style={{ left: bScreen.x, top: bScreen.y }}
        >
          {Math.round(rulerMeas.feet)} ft
        </div>
      )}
      {targetCount > 0 && (
        <button
          onClick={() => clearTargets()}
          className="absolute left-1/2 top-2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-red-600/90 px-3 py-1 text-xs font-semibold text-white shadow"
        >
          <i className="fas fa-crosshairs" aria-hidden="true" />
          {targetCount} target{targetCount > 1 ? "s" : ""}
          <i className="fas fa-xmark" aria-hidden="true" />
        </button>
      )}
      <button
        onClick={toggleRuler}
        aria-pressed={rulerMode}
        className={`absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full shadow ${rulerMode ? "bg-amber-500 text-black" : "bg-zinc-800/90 text-zinc-200"}`}
        title={rulerMode ? "Exit ruler" : "Measure distance"}
      >
        <i className="fas fa-ruler" aria-hidden="true" />
      </button>
      {infoToken && <TokenInfoPopup token={infoToken} onClose={() => setInfoId(null)} />}
    </div>
  );
```

> Note: `gridSpec()` reads `canvas.scene.grid.size` (the canvas-mode grid pixel size) rather than `view.dims.size`, so the ruler matches the canvas exactly. `GridSpec`/`Point`/`measureDistance`/`snapToCenter` are the existing Phase 7 ruler exports — unchanged.

- [ ] **Step 5: Typecheck + build + full test.**

Run: `npm run typecheck && npm run build && npm run test`
Expected: all green.

- [ ] **Step 6: FINAL LIVE CHECKLIST** (player on mobile width; GM on desktop; active scene with walls, a light, an ally, an enemy behind a wall, and a GM-hidden token):
  - Board renders the active scene; **fog/vision hides the enemy** until line of sight opens; the GM-hidden token never appears.
  - Pan / pinch / wheel feel right; the **ruler** toggles, snaps A→B, shows feet, and the line **stays glued to the map** while you pan/zoom (canvasPan re-projection).
  - Tap a token → popup → **Target** (GM sees the reticle) / **Untarget**; the **clear-targets** chip clears all.
  - Drag **your** token → snaps + moves within ~1s; rejected move reverts.
  - Leave Map → CPU/GPU/battery drop to baseline (DevTools); return → instant.
  - Set **mapRenderer → Lite** in settings → reload → the Phase 7 DOM map renders (canvas off); set back to **Canvas** → reload → canvas map returns.

- [ ] **Step 7: Commit.**

```bash
git add src/app/map/CanvasMap.tsx
git commit -m "canvas-map (Task 7): ruler overlay synced to canvas pan + clear-targets button" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Spec coverage (self-review)

| Spec section | Task(s) |
|---|---|
| §1 Layering (enable canvas, reveal `#board`, transparent root, input layer) | 2 (enable), 3 (CSS + lifecycle), 5 (input layer) |
| §2 Rendering = canvas (view active scene) | 3 (`viewActiveScene`/`fitActiveScene`), 5 (wiring) |
| §3 Touch layer — pan/zoom | 4 (math), 5 (handlers) |
| §3 Touch layer — tap→target | 4 (hitTest), 5 (popup bridge) |
| §3 Touch layer — drag-own-token | 6 |
| §3 Overlays — ruler, clear-targets, macro bar | 7 (ruler/clear), MapTab keeps MacroBar (5) |
| §4 Performance isolation (pause/resume) | 3 (`pause/resumeCanvas`), 5 (`useCanvasLifecycle`) |
| §5 Fallback + `mapRenderer` setting | 1 (setting), 2 (noCanvas target), 5 (MapTab pick) |
| §7 Spike-first gate | 0 |
| Risk: canvas-off assumptions / `withCanvasGrid` | 6 (audit) |

**Notes from grounding (corrections vs. spec):** `actions.ts`'s `withCanvasGrid` is **kept**, not dropped — it already no-ops in canvas mode and the `lite` fallback needs it. ⚠ Live-confirm items carried from the spec: `canvas.app.ticker` pause path; `stage.toLocal`/`token.bounds` world mapping (devicePixelRatio); `canvas.pan` scale clamps. These are exercised by the Task 5/7 live checkpoints, not unit tests.
