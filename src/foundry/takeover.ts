import { getNoCanvas, setNoCanvas, getPriorNoCanvas, setPriorNoCanvas } from "./settings";

const MODULE_ID = "pf2e-mobile-companion";
const ROOT_ID = `${MODULE_ID}-root`;
const BODY_CLASS = "pf2e-mobile-active";
const RELOAD_SENTINEL = "pf2e-mc-canvas-reload";

export function isTakeoverActive(): boolean {
  return document.body.classList.contains(BODY_CLASS);
}

/**
 * Ensure the canvas is disabled, then hide stock UI and mount the app.
 * If `noCanvas` had to be turned on, persist it and reload once (guarded against
 * a loop); `mountFn` then runs after the reload, on the next `ready`.
 */
export async function applyTakeover(
  mountFn: (container: HTMLElement) => void | Promise<void>,
): Promise<void> {
  if (!getNoCanvas()) {
    if (sessionStorage.getItem(RELOAD_SENTINEL)) {
      console.error(`${MODULE_ID} | noCanvas did not persist; aborting reload to avoid a loop`);
      return;
    }
    sessionStorage.setItem(RELOAD_SENTINEL, "1");
    await setPriorNoCanvas(getNoCanvas());
    await setNoCanvas(true);
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
