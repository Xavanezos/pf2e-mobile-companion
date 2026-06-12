import {
  getNoCanvas, setNoCanvas, getPriorNoCanvas, setPriorNoCanvas,
  getMapRenderer, desiredNoCanvas,
} from "./settings";

const MODULE_ID = "pf2e-mobile-companion";
const ROOT_ID = `${MODULE_ID}-root`;
const BODY_CLASS = "pf2e-mobile-active";
const RELOAD_SENTINEL = "pf2e-mc-canvas-reload";

export function isTakeoverActive(): boolean {
  return document.body.classList.contains(BODY_CLASS);
}

/**
 * Ensure `core.noCanvas` matches the chosen map renderer (false for canvas,
 * true for lite), then hide stock UI and mount the app. If it had to be flipped,
 * save the user's prior value, persist the new one, and reload once (guarded
 * against a loop); `mountFn` then runs after the reload, on the next `ready`.
 */
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

/** Remove the takeover, restore the user's prior canvas preference, and reload. */
export async function removeTakeover(): Promise<void> {
  document.body.classList.remove(BODY_CLASS);
  document.getElementById(ROOT_ID)?.remove();
  await setNoCanvas(getPriorNoCanvas());
  location.reload();
}

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
