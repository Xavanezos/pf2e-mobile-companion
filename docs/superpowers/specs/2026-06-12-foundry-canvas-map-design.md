# Foundry Canvas on the Map tab — Design

**Date:** 2026-06-12
**Status:** Approved (brainstorming complete)
**Target:** Foundry VTT v14, PF2e system v8.2+, Chrome on Android (primary)
**Builds on / supersedes:** Phase 7 lightweight battle map (`docs/superpowers/specs/2026-06-12-phase-7-battle-map-design.md`). The Phase 7 DOM renderer is **retained as a fallback**, not deleted.

## Goal

Make the **Map** tab mirror Foundry's actual-play view — walls (invisible, occluding), dynamic lighting, fog of war, and vision/senses — by **rendering the real Foundry PIXI canvas** on that tab, instead of re-implementing a vision/lighting engine over the DOM. The rest of the app stays exactly as light as today: the canvas only renders while the Map tab is visible.

**Why canvas, not a re-build.** With `core.noCanvas` on (the app's foundational Phase 1 decision), Foundry computes **no** vision pipeline — so "mirror actual play" would otherwise mean hand-rolling Foundry's `ClockwiseSweepPolygon`, light compositing, senses model, and fog buffer from raw `scene.walls`/`scene.lights`. The real canvas gives all of that natively, at zero reimplementation and perfect fidelity. The cost is performance, which we isolate to the Map tab (see §4) and **validate on-device before committing** (see §7).

## Decisions (locked during brainstorming)

| Topic | Decision |
|-------|----------|
| Fidelity | **Full player vision** — wall-occluded sight + dynamic lighting + fog of war, all native from the canvas |
| Renderer | **The real Foundry canvas** is the Map renderer; we do not re-draw the scene in the DOM |
| Tokens | **(A) Canvas-rendered tokens** — Foundry draws sprites with native occlusion, status icons, bars, reticles. We do **not** keep DOM token sprites on the canvas path |
| Targeting | **Preserved unchanged** — tap hit-tests a token → existing `TokenInfoPopup` → `toggleTarget`. The targeting mechanism (`game.user.targets` + `broadcastActivity`) is already canvas-free |
| Off-tab | **Keep-alive + pause** — canvas stays initialized but its render loop stops off the Map tab; instant return; scene textures remain GPU-resident for the session (accepted) |
| Fallback | **Keep the Phase 7 DOM map** behind a `mapRenderer` setting (`canvas` default \| `lite`); `lite` keeps `noCanvas` on for weak devices / canvas-init failure |
| Validation | **Spike-first** — an on-device perf + isolation checkpoint gates the full build |

## Architecture & data flow

Three concerns, layered:

```
Map tab (MapTab)
  ├─ chooses renderer by setting / canvas availability:
  │     mapRenderer === 'canvas' && canvas.ready  → <CanvasMap/>   (this design)
  │     else                                       → <BattleMap/>   (Phase 7 DOM fallback, unchanged)
  │
  └─ <CanvasMap/>  =  the real #board canvas  +  a transparent mobile input layer + overlays
        • visuals: Foundry canvas (bg, walls, lights, fog, vision, tokens, reticles)   ← native
        • input layer (transparent, above #board, captures all touch):
            – 1-finger drag      → canvas.pan({x,y,scale})            (pan)
            – 2-finger pinch     → canvas.pan({x,y,scale})            (zoom about focal)
            – wheel (desktop)    → canvas.pan({x,y,scale})
            – tap on a token     → hitTest → TokenInfoPopup → toggleTarget   (targeting)
            – drag my own token  → moveToken(sceneId, id, x, y)       (guarded; grid-snapped)
        • overlays (React, above #board): ruler line (screen-space, synced to canvas xform),
            "clear targets" button, MacroBar (pinned, unchanged)
        • data for the popup/target-count: useScene(actorId) → buildSceneView   ← canvas-free, reused
```

### §1 Layering (grounded in the current CSS)

Today `src/styles/tailwind.css` hides `#board` (and all stock chrome) with `display:none !important` under `body.pf2e-mobile-active`. New model:

- **Enable the canvas at boot.** `takeover.ts` currently forces `noCanvas = true` + reload; invert the target to `noCanvas = false` when `mapRenderer === 'canvas'`. Same save/set/reload-guard machinery, one-time migration reload per browser profile.
- **Reveal the board only on the Map tab.** A new `pf2e-mobile-map-active` class (toggled with `activeTab`, added alongside `pf2e-mobile-active`) overrides `#board` from `display:none` to a positioned, `fixed`, full-viewport element. The existing hide rule is `!important`, so the reveal must **out-specify** it (not merely follow it): author it as `body.pf2e-mobile-active.pf2e-mobile-map-active #board { display:block !important }` — two body classes beat the one-class hide. Off the Map tab the class drops and `#board` is `display:none` again.
- **Stacking.** `#board` and the React root `#pf2e-mobile-companion-root` are both `body` children. Give the root a higher `z-index` than the board and render the **Map tab's content area transparent**, so the board shows through the "hole" while the root's opaque chrome (header, tab bar, macro bar, map buttons, input layer) paints above it.
- **Input ownership.** The transparent input layer lives in the React root, above the board, and captures all pointer events — so our mobile gestures drive the canvas and Foundry's native (desktop-oriented) canvas interaction never competes.

### §2 Rendering = the real canvas

Background, walls (invisible + occluding), dynamic lighting, fog of war, vision/senses, token sprites, native status-effect icons, bars, and target reticles all come from Foundry. On entering the Map tab we ensure the **active** scene is the viewed scene: if `canvas.scene?.id !== game.scenes.active?.id`, call `game.scenes.active.view()`. We render `game.scenes.active` to stay consistent with the rest of the app (which never uses `.viewed`).

### §3 Touch layer (the only custom map code on this path)

- **Pan/zoom.** Reuse the Phase 7 gesture skeleton (pointer bookkeeping, pinch midpoint/distance, tap-vs-drag slop), but the *output* drives `canvas.pan({x, y, scale})` instead of a CSS transform. Pinch keeps the scene point under the focal screen point fixed (same inverse-transform math, expressed in canvas world coords).
- **Tap → target.** On a tap (movement under slop), convert the screen point to canvas world coords (`canvas.stage.toLocal`/`worldTransform.applyInverse`) and pick the **topmost `token.visible` placeable** whose bounds contain it. That token id opens the existing `TokenInfoPopup` (built from the `useScene` `TokenView`), whose **Target/Untarget** button calls the unchanged `toggleTarget(id)`.
- **Drag-own-token.** A press that begins on one of my tokens (`token.isOwner`) starts a drag; on release, `moveToken(sceneId, id, x, y)` (existing guarded action; snaps via `scene.grid.getTopLeftPoint`). **Remove the Phase 7 `canvas.grid` lend hack** — `canvas.grid` is real now. Live drag feedback (nudging the PIXI token, or a simple marker) is a refinement, not required for v1.
- **Overlays.** The ruler stays our touch-tuned tool but renders as a **screen-space** SVG overlay, converting its scene-space A→B endpoints through the canvas transform and re-syncing on the `canvasPan` hook. The "clear targets" button and `MacroBar` are unchanged screen chrome.
- **Data reuse.** `useScene`/`buildSceneView` remain the popup's data source (name/HP/conditions/disposition/`targeted`) and the target-count — they read documents, not the canvas, so they need no change.

### §4 Performance isolation (keep-alive)

- **On Map tab:** `canvas.app.ticker.start()`, add `pf2e-mobile-map-active` (show `#board`), view + fit the active scene.
- **Off Map tab:** `canvas.app.ticker.stop()`, remove the class (`#board` → `display:none`). CPU/GPU/battery return to today's no-canvas baseline; non-map tabs are byte-for-byte unaffected. Document updates still flow through hooks while paused; a resume render reflects the current state.
- **Accepted costs:** (1) heavier world **load** — the canvas initializes at boot; (2) the active scene's textures stay **GPU-resident** for the session. No other regression.

### §5 Fallback + setting

A `mapRenderer` **client** setting:
- `canvas` (default) → `noCanvas` off, `<CanvasMap>`.
- `lite` → `noCanvas` on, the Phase 7 `<BattleMap>` (today's behavior).

`MapTab` also auto-falls-back to `<BattleMap>` if `mapRenderer === 'canvas'` but the canvas isn't ready (init failure). Changing the setting flips `noCanvas` and reloads via the existing guarded machinery. All Phase 7 code (`BattleMap`, `TokenSprite`, DOM pan/zoom, DOM targeting/drag) is retained verbatim as this path.

## Components & files

**New**
| File | Purpose |
|---|---|
| `src/foundry/canvas/lifecycle.ts` | `pauseCanvas()`/`resumeCanvas()` (ticker + board visibility), `viewActiveScene()`, `fitActiveScene()`, `isCanvasReady()` — the only code that touches `canvas.*` |
| `src/foundry/canvas/hitTest.ts` | `pickTopTokenAt(point, tokens)` — **pure** core (topmost visible token whose rect contains the point), unit-tested; thin live wrapper reads `canvas.tokens.placeables` + `canvas.stage` transform |
| `src/app/map/CanvasMap.tsx` | The canvas-path renderer: transparent input layer over `#board`, gestures → `canvas.pan`, tap → popup, drag → `moveToken`, ruler/clear-target overlays |
| `src/app/map/useCanvasLifecycle.ts` | Pause/resume on `activeTab` change; view+fit on Map-tab enter |

**Changed**
- `src/foundry/takeover.ts` — invert the `noCanvas` target when `mapRenderer === 'canvas'`; keep the reload-guard.
- `src/foundry/settings.ts` — register the `mapRenderer` client setting (+ get/set helpers); `onChange` flips `noCanvas` and reloads.
- `src/app/tabs/MapTab.tsx` — pick `<CanvasMap>` vs `<BattleMap>` by setting + `canvas.ready`; `MacroBar` stays pinned.
- `src/foundry/scene/actions.ts` — drop the `canvas.grid` lend now that `canvas.grid` exists; keep the guarded `moveToken` + grid snap.
- `src/styles/tailwind.css` — add the `body.pf2e-mobile-map-active #board` reveal/position rule; ensure the Map tab content area is transparent and the root out-stacks the board.

**Reused untouched**
`src/foundry/scene/targeting.ts`, `src/foundry/scene/ruler.ts`, `src/app/map/TokenInfoPopup.tsx`, `src/app/map/useScene.ts`, `src/foundry/scene/view.ts`/`types.ts`; `src/app/map/BattleMap.tsx` + `TokenSprite.tsx` as the `lite` fallback.

## Live-API grounding (⚠ = confirm in the spike / during impl)

1. ✅ **`game.scenes.active`** and `scene.dimensions` are canvas-free (Phase 7). With the canvas **on**, `canvas.scene` becomes the *viewed* scene; we `game.scenes.active.view()` to align them.
2. ⚠ **`canvas.app.ticker.stop()/start()`** halts/resumes only the canvas render loop (battery drops) without disturbing other Foundry loops (audio, `game.time`, hook dispatch). Confirm; fall back to `canvas.app.stop()/start()` or a render-flag if needed.
3. ⚠ **Screen→world** via `canvas.stage.toLocal(globalPoint)` / `canvas.stage.worldTransform.applyInverse(...)`; **token hit-test** via `canvas.tokens.placeables` filtered by `token.visible`, testing `token.bounds.contains(x,y)` (topmost wins). Confirm the exact bounds/visibility getters in v14.364.
4. ⚠ **`canvas.pan({x, y, scale})`** centers the view on scene point `(x,y)` at zoom `scale`; `canvas.dimensions`/`canvas.stage.scale` give the clamps for an initial fit. Confirm min/max scale wiring.
5. ✅ **Targeting** (`game.user.targets.add/delete/clear` + `broadcastActivity({sceneId, targets})`) is canvas-free and unchanged (source-verified in Phase 7). With the canvas on, the local user's reticles now also render natively — acceptable/desirable.
6. ⚠ **`token.visible`** reflects current vision/fog for the active user — the property our hit-test and the fidelity goal depend on. Confirm a player only sees fog-appropriate tokens (the core win).
7. ⚠ **`core.noCanvas`** is a client setting saved/restored as today; flipping it to `false` is contained to this browser profile and reverted by escape-to-desktop. Confirm no PF2e/module assumes it stays on.

## Testing

- **TDD the pure core:** `tests/canvasHitTest.test.ts` — `pickTopTokenAt(point, tokens)`: picks the topmost rect containing the point, ignores non-visible tokens, returns null on a miss; ties broken by z/last. Setting logic (`mapRenderer → noCanvas` target) gets a small pure test.
- **Reuse:** existing `targeting`, `moveToken`, `sceneView`, `ruler` tests stand (those paths are unchanged).
- **Manual live checklist** (canvas is a global singleton — the integration is verified live, like Phase 7): board renders the active scene; **fog/vision hides enemy tokens a player shouldn't see**; pan/pinch/wheel feel right; tap a token → info popup → Target sets a reticle the GM sees; drag-own-token snaps + moves within ~1s and reverts on rejection; ruler measures correctly over the canvas; leaving the Map tab drops CPU/GPU to baseline (DevTools) and returning is instant; `lite` setting falls back to the Phase 7 map.
- **Gate:** `npm run typecheck` + production `npm run build` + tests green at each task; live checkpoints after the spike, after pan/zoom, and at the end.

## Execution outline (detailed plan via writing-plans)

1. **Spike (throwaway, gating):** canvas on under the Map tab on the real device + a representative scene — measure memory/battery/frame-pacing; confirm ticker-pause isolation, gesture→`canvas.pan` feel, tap hit-test, and fog-correct token visibility. **Green-light A, or fall back to `lite`/re-scope.**
2. **Canvas enablement + `mapRenderer` setting:** invert `noCanvas` target; `MapTab` renderer pick; migration reload.
3. **Lifecycle:** `lifecycle.ts` + `useCanvasLifecycle` (pause/resume on tab change), the `pf2e-mobile-map-active` CSS, view + fit on enter.
4. **CanvasMap render + pan/zoom:** input layer over the board, gestures → `canvas.pan`. *Live checkpoint.*
5. **Tap → hit-test → popup → targeting:** `hitTest.ts` (TDD core) + popup bridge.
6. **Drag-own-token → `moveToken`:** bridge drag; remove the `canvas.grid` lend; **audit other canvas-off assumptions**.
7. **Overlays + fallback polish:** ruler overlay synced to the canvas transform; clear-targets button; verify `lite` fallback.

## Out of scope (deferred / YAGNI)

- **Apply-damage** to a token — now *unblocked* by a real canvas token (Phase 3/4 deferral), but a separate effort.
- GM-only tooling (wall/light editing, scene navigation, drawing, templates beyond the existing ruler).
- Weather/ambient-sound toggles, multi-scene switching (still `game.scenes.active` only).
- iOS Safari memory tuning (target is Android Chrome; revisit if needed).
- Keeping DOM token sprites *on the canvas path* (that was option B — explicitly not chosen).
