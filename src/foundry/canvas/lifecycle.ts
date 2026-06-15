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

// Cosmetic layers hidden on the mobile map so it reads as a clean tactical board.
// The scene, grid, walls/doors, lighting, vision/fog, tokens, and measured templates
// stay; weather, drawings, journal notes, and ambient-sound pins go. (Dice So Nice
// is a separate body-level overlay, hidden via CSS.)
const COSMETIC_LAYERS = ["weather", "drawings", "notes", "sounds"] as const;

/** Hide the cosmetic layers on the live canvas. No-op when the canvas is off. */
export function hideCosmeticLayers(): void {
  const cv = liveCanvas();
  if (!cv?.ready) return;
  for (const name of COSMETIC_LAYERS) {
    const layer = cv[name];
    if (layer) layer.visible = false;
  }
}

let declutterInstalled = false;
/** Keep the cosmetic layers hidden for the session. A scene change redraws the canvas
 *  and resets layer visibility, so re-apply on every `canvasReady`. Idempotent; call
 *  once when the takeover mounts (safe in lite mode — `hideCosmeticLayers` no-ops). */
export function installCanvasDeclutter(): void {
  if (declutterInstalled) return;
  declutterInstalled = true;
  Hooks.on("canvasReady", () => hideCosmeticLayers());
  hideCosmeticLayers(); // the canvas may already be ready at install
}
