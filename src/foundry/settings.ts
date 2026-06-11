import { detectMobile, type UiMode } from "./mobile";

export const MODULE_ID = "pf2e-mobile-companion";

/** Register client settings at `init`. `onUiModeChange` runs when the user
 *  flips the mode (e.g. from Foundry's settings menu or our in-app control). */
export function registerSettings(onUiModeChange: () => void): void {
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

  // Remembers the user's canvas preference before mobile mode forced it off,
  // so exiting mobile mode restores it instead of leaving canvas disabled.
  (game as any).settings.register(MODULE_ID, "priorNoCanvas", {
    scope: "client",
    config: false,
    type: Boolean,
    default: false,
  });
}

export function getUiMode(): UiMode {
  return ((game as any).settings.get(MODULE_ID, "uiMode") as UiMode) ?? "auto";
}
export async function setUiMode(mode: UiMode): Promise<void> {
  await (game as any).settings.set(MODULE_ID, "uiMode", mode);
}

/** Combine the user's override setting with live device signals. */
export function isMobileActive(): boolean {
  return detectMobile({
    ua: navigator.userAgent,
    width: window.innerWidth,
    override: getUiMode(),
  });
}

export function getNoCanvas(): boolean {
  return Boolean((game as any).settings.get("core", "noCanvas"));
}
export async function setNoCanvas(value: boolean): Promise<void> {
  await (game as any).settings.set("core", "noCanvas", value);
}

export function getPriorNoCanvas(): boolean {
  return Boolean((game as any).settings.get(MODULE_ID, "priorNoCanvas"));
}
export async function setPriorNoCanvas(value: boolean): Promise<void> {
  await (game as any).settings.set(MODULE_ID, "priorNoCanvas", value);
}
