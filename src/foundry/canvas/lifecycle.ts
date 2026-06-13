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
